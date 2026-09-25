// ==================================================
// CLIPBOARDFILTER - JSON Store
// Small in-memory JSON store with debounced, atomic writes.
// Replaces electron-store, which re-read and re-parsed the whole file from
// disk on every access. Uses the same file (config.json in userData), so
// existing configurations are kept.
// ==================================================

import * as fs from 'fs';
import * as path from 'path';

export class JsonStore<T extends object> {
  private data: T;
  private writeTimer: NodeJS.Timeout | null = null;
  private dirty = false;

  constructor(private filePath: string, defaults: T, private writeDelayMs = 150) {
    this.data = this.load(defaults);
  }

  public get<K extends keyof T>(key: K): T[K] {
    return this.data[key];
  }

  public set<K extends keyof T>(key: K, value: T[K]): void {
    this.data[key] = value;
    this.scheduleWrite();
  }

  public get path(): string {
    return this.filePath;
  }

  /** Writes pending changes synchronously (call before quitting). */
  public flush(): void {
    if (this.writeTimer) {
      clearTimeout(this.writeTimer);
      this.writeTimer = null;
    }
    if (!this.dirty) return;
    this.dirty = false;
    try {
      fs.mkdirSync(path.dirname(this.filePath), { recursive: true, mode: 0o700 });
      const tmp = `${this.filePath}.${process.pid}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2), { encoding: 'utf-8', mode: 0o600 });
      fs.renameSync(tmp, this.filePath);
    } catch (error) {
      console.error('[Store] Failed to write configuration:', error);
      this.dirty = true;
    }
  }

  private scheduleWrite(): void {
    this.dirty = true;
    if (this.writeTimer) return;
    this.writeTimer = setTimeout(() => {
      this.writeTimer = null;
      this.flush();
    }, this.writeDelayMs);
  }

  private load(defaults: T): T {
    let raw: string;
    try {
      raw = fs.readFileSync(this.filePath, 'utf-8');
    } catch {
      return structuredClone(defaults);
    }
    try {
      const parsed = JSON.parse(raw.replace(/^﻿/, ''));
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Not an object');
      return { ...structuredClone(defaults), ...parsed };
    } catch (error) {
      // Keep the corrupted file for manual recovery instead of overwriting it.
      const backup = `${this.filePath}.corrupt-${Date.now()}`;
      console.error(`[Store] Corrupted configuration, backed up to ${backup}:`, error);
      try { fs.renameSync(this.filePath, backup); } catch { /* ignore */ }
      return structuredClone(defaults);
    }
  }
}
