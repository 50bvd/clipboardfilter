// ==================================================
// CLIPBOARDFILTER - Filter Runner
// Runs the filter engine in a worker thread with a timeout, so that a
// pathological regular expression (ReDoS) can never freeze the app.
// Fails closed: on timeout the text is NOT returned unfiltered.
// ==================================================

import * as fs from 'fs';
import * as path from 'path';
import { Worker } from 'worker_threads';
import { EngineRule, FilterResult, WORKER_FLAG, applyRules, compileRules, CompiledRuleSet } from './filterEngine';

export class FilterTimeoutError extends Error {
  constructor(public ruleId: string | null) {
    super('Filtering timed out');
    this.name = 'FilterTimeoutError';
  }
}

interface Pending {
  resolve: (r: FilterResult) => void;
  reject: (e: Error) => void;
  timer: NodeJS.Timeout;
}

export class FilterRunner {
  private worker: Worker | null = null;
  private workerSource: string | null = null;
  private workerBroken = false;
  private rules: EngineRule[] = [];
  private version = 0;
  private ruleIds: string[] = [];
  private pending = new Map<number, Pending>();
  private nextId = 1;
  private progress = new SharedArrayBuffer(4);
  private progressView = new Int32Array(this.progress);
  // In-process fallback when worker threads are unavailable
  private localSet: CompiledRuleSet | null = null;

  constructor(private baseTimeoutMs = 3000) {}

  public setRules(rules: EngineRule[]): void {
    this.rules = rules.map(r => ({
      id: r.id, pattern: r.pattern, replacement: r.replacement, useRegex: r.useRegex, enabled: r.enabled, caseSensitive: !!r.caseSensitive
    }));
    this.version++;
    this.localSet = null;
    this.ruleIds = [];
    if (this.worker) this.postRules();
  }

  public async filter(text: string, withDetails = false): Promise<FilterResult> {
    if (!text) return { filtered: text ?? '', count: 0, details: withDetails ? [] : undefined };

    const worker = this.ensureWorker();
    if (!worker) {
      if (!this.localSet) this.localSet = compileRules(this.rules);
      return applyRules(this.localSet, text, withDetails);
    }

    const id = this.nextId++;
    // Scale the timeout with the input size (roughly 1 ms per 4 KB).
    const timeoutMs = this.baseTimeoutMs + Math.floor(text.length / 4096);

    return new Promise<FilterResult>((resolve, reject) => {
      const timer = setTimeout(() => this.handleTimeout(), timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      worker.postMessage({ type: 'filter', id, text, details: withDetails });
    });
  }

  public dispose(): void {
    this.rejectAll(new Error('Filter runner disposed'));
    if (this.worker) {
      this.worker.removeAllListeners();
      this.worker.terminate().catch(() => undefined);
      this.worker = null;
    }
  }

  private ensureWorker(): Worker | null {
    if (this.worker) return this.worker;
    if (this.workerBroken) return null;
    try {
      if (!this.workerSource) {
        // Loaded as source (eval) so it also works from inside an asar archive.
        this.workerSource = fs.readFileSync(path.join(__dirname, 'filterEngine.js'), 'utf-8');
      }
      const worker = new Worker(this.workerSource, {
        eval: true,
        workerData: { [WORKER_FLAG]: true, progress: this.progress },
        resourceLimits: { maxOldGenerationSizeMb: 512 }
      });
      worker.on('message', (msg: any) => this.onMessage(msg));
      worker.on('error', (err) => {
        console.error('[FilterRunner] Worker error:', err);
        this.discardWorker(err instanceof Error ? err : new Error(String(err)));
      });
      worker.on('exit', (code) => {
        if (this.worker === worker) this.discardWorker(new Error(`Filter worker exited (${code})`));
      });
      worker.unref();
      this.worker = worker;
      this.postRules();
      return worker;
    } catch (error) {
      console.error('[FilterRunner] Worker threads unavailable, filtering in-process:', error);
      this.workerBroken = true;
      return null;
    }
  }

  private postRules(): void {
    this.worker?.postMessage({ type: 'rules', version: this.version, rules: this.rules });
  }

  private onMessage(msg: any): void {
    if (msg.type === 'rules-ok') {
      if (msg.version === this.version) this.ruleIds = msg.ids || [];
      return;
    }
    const pending = this.pending.get(msg.id);
    if (!pending) return;
    this.pending.delete(msg.id);
    clearTimeout(pending.timer);
    if (msg.type === 'result') pending.resolve(msg.result);
    else pending.reject(new Error(msg.message || 'Filter error'));
  }

  private handleTimeout(): void {
    const index = Atomics.load(this.progressView, 0);
    const ruleId = index >= 0 && index < this.ruleIds.length ? this.ruleIds[index] : null;
    console.error(`[FilterRunner] Filtering timed out (rule: ${ruleId ?? 'unknown'}), restarting worker`);
    this.discardWorker(new FilterTimeoutError(ruleId));
  }

  private discardWorker(reason: Error): void {
    const worker = this.worker;
    this.worker = null;
    Atomics.store(this.progressView, 0, -1);
    this.rejectAll(reason);
    if (worker) {
      worker.removeAllListeners();
      worker.terminate().catch(() => undefined);
    }
  }

  private rejectAll(reason: Error): void {
    for (const [, p] of this.pending) {
      clearTimeout(p.timer);
      p.reject(reason);
    }
    this.pending.clear();
  }
}
