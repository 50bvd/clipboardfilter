// ==================================================
// CLIPBOARDFILTER - Clipboard watcher (automatic mode)
// Filters the clipboard as soon as something is copied, so a normal
// Ctrl+V / Cmd+V pastes filtered content (no keystroke simulation needed).
// ==================================================

import { clipboard } from 'electron';
import { ChildProcess, spawn } from 'child_process';
import { findCommand, isWayland, readClipboardText } from './platform';

export type WatchMode = 'off' | 'poll' | 'wl-watch' | 'limited';

export class ClipboardWatcher {
  private timer: NodeJS.Timeout | null = null;
  private proc: ChildProcess | null = null;
  private lastSeen: string | null = null;
  private lastWritten: string | null = null;
  private busy = false;
  private mode: WatchMode = 'off';

  constructor(private onChange: (text: string) => Promise<void>, private intervalMs = 500) {}

  public getMode(): WatchMode {
    return this.mode;
  }

  /** Remembers text written by the app so it is not processed again. */
  public markWritten(text: string): void {
    this.lastWritten = text;
    this.lastSeen = text;
  }

  /** Starts watching; the current clipboard content is filtered right away. */
  public start(): WatchMode {
    this.stop();
    this.lastSeen = null;
    if (process.platform === 'linux' && isWayland() && findCommand('wl-paste')) {
      this.startWlWatch();
      return this.mode;
    }
    this.startPolling(process.platform === 'linux' && isWayland() ? 'limited' : 'poll');
    return this.mode;
  }

  public stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    if (this.proc) {
      this.proc.removeAllListeners();
      try { this.proc.kill(); } catch { /* ignore */ }
    }
    this.proc = null;
    this.mode = 'off';
  }

  private startPolling(mode: WatchMode): void {
    this.mode = mode;
    this.lastSeen = null;
    let reading = false;
    this.timer = setInterval(async () => {
      if (this.busy || reading) return;
      reading = true;
      let text: string;
      try { text = await clipboard.readText(); } catch { return; } finally { reading = false; }
      this.handle(text);
    }, this.intervalMs);
  }

  // wl-paste --watch runs a command on every clipboard change. It requires
  // the data-control protocol (KDE Plasma, wlroots compositors...). GNOME does
  // not provide it, in which case wl-paste exits immediately.
  private startWlWatch(): void {
    const startedAt = Date.now();
    const proc = spawn(findCommand('wl-paste')!, ['--type', 'text', '--watch', 'echo', 'changed'], {
      stdio: ['ignore', 'pipe', 'ignore']
    });
    this.proc = proc;
    this.mode = 'wl-watch';
    proc.stdout!.setEncoding('utf8');
    proc.stdout!.on('data', async () => {
      if (this.busy) return;
      const text = await readClipboardText().catch(() => '');
      this.handle(text);
    });
    proc.on('error', () => this.fallbackFromWatch());
    proc.on('exit', () => {
      if (this.proc !== proc) return;
      // Exited right away -> unsupported compositor, fall back to polling.
      if (Date.now() - startedAt < 3000) this.fallbackFromWatch();
      else this.startWlWatch();
    });
  }

  private fallbackFromWatch(): void {
    if (this.proc) this.proc.removeAllListeners();
    this.proc = null;
    this.startPolling('limited');
  }

  private handle(text: string): void {
    if (!text || text === this.lastSeen) return;
    this.lastSeen = text;
    if (text === this.lastWritten) return;
    this.busy = true;
    this.onChange(text)
      .catch((e) => console.error('[Watcher] Error:', e))
      .finally(() => { this.busy = false; });
  }
}
