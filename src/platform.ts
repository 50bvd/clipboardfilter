// ==================================================
// CLIPBOARDFILTER - Platform helpers
// Session detection (X11 / Wayland / desktop), external tool lookup,
// clipboard access with Wayland fallbacks and login-item management.
// ==================================================

import { app, clipboard } from 'electron';
import { execFile, spawn } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

export type SessionType = 'windows' | 'macos' | 'x11' | 'wayland' | 'unknown';

export interface SessionInfo {
  platform: NodeJS.Platform;
  session: SessionType;
  desktop: string;
  isAppImage: boolean;
  isFlatpak: boolean;
}

let cachedSession: SessionInfo | null = null;

export function getSessionInfo(): SessionInfo {
  if (cachedSession) return cachedSession;
  const env = process.env;
  let session: SessionType = 'unknown';
  if (process.platform === 'win32') session = 'windows';
  else if (process.platform === 'darwin') session = 'macos';
  else if (env.WAYLAND_DISPLAY || (env.XDG_SESSION_TYPE || '').toLowerCase() === 'wayland') session = 'wayland';
  else if (env.DISPLAY || (env.XDG_SESSION_TYPE || '').toLowerCase() === 'x11') session = 'x11';

  cachedSession = {
    platform: process.platform,
    session,
    desktop: env.XDG_CURRENT_DESKTOP || env.DESKTOP_SESSION || '',
    isAppImage: !!env.APPIMAGE,
    isFlatpak: !!env.FLATPAK_ID || fs.existsSync('/.flatpak-info')
  };
  return cachedSession;
}

export function isWayland(): boolean {
  return getSessionInfo().session === 'wayland';
}

// ---------- External tools ----------

const commandCache = new Map<string, string | null>();

/** Returns the absolute path of an executable found in PATH, or null. */
export function findCommand(name: string): string | null {
  if (commandCache.has(name)) return commandCache.get(name)!;
  let found: string | null = null;
  const exts = process.platform === 'win32' ? (process.env.PATHEXT || '.EXE;.CMD;.BAT').split(';') : [''];
  for (const dir of (process.env.PATH || '').split(path.delimiter)) {
    if (!dir) continue;
    for (const ext of exts) {
      const candidate = path.join(dir, name + ext);
      try {
        fs.accessSync(candidate, fs.constants.X_OK);
        if (fs.statSync(candidate).isFile()) { found = candidate; break; }
      } catch { /* not here */ }
    }
    if (found) break;
  }
  commandCache.set(name, found);
  return found;
}

export interface RunResult {
  code: number | null;
  stdout: string;
  stderr: string;
}

/** Runs a command without a shell (no injection possible), with a timeout. */
export function run(cmd: string, args: string[], options: { input?: string; timeoutMs?: number; env?: NodeJS.ProcessEnv } = {}): Promise<RunResult> {
  return new Promise((resolve) => {
    const child = execFile(cmd, args, {
      timeout: options.timeoutMs ?? 2000,
      maxBuffer: 64 * 1024 * 1024,
      encoding: 'utf8',
      windowsHide: true,
      env: options.env ?? process.env
    }, (error: any, stdout, stderr) => {
      const code = error ? (typeof error.code === 'number' ? error.code : -1) : 0;
      resolve({ code, stdout: stdout ?? '', stderr: stderr ?? '' });
    });
    if (options.input !== undefined && child.stdin) {
      child.stdin.on('error', () => undefined);
      child.stdin.end(options.input);
    }
  });
}

// ---------- Clipboard ----------

/**
 * On Wayland, a background (unfocused) client is not allowed to read or set
 * the clipboard through the core protocol. wl-clipboard works around this
 * (data-control protocol on KDE/wlroots, focus trick on GNOME), so it is
 * preferred when installed.
 */
function useWlClipboard(): boolean {
  return process.platform === 'linux' && isWayland() && !!findCommand('wl-paste') && !!findCommand('wl-copy');
}

export async function readClipboardText(): Promise<string> {
  if (useWlClipboard()) {
    const r = await run(findCommand('wl-paste')!, ['--no-newline', '--type', 'text'], { timeoutMs: 1500 });
    if (r.code === 0) return r.stdout;
    // "No selection" / "No suitable type" -> empty clipboard
    if (/no (selection|suitable type)/i.test(r.stderr)) return '';
  }
  return clipboard.readText();
}

export async function writeClipboardText(text: string): Promise<void> {
  if (useWlClipboard()) {
    // wl-copy forks and keeps serving the selection in the background.
    const ok = await new Promise<boolean>((resolve) => {
      const child = spawn(findCommand('wl-copy')!, ['--type', 'text/plain;charset=utf-8'], { stdio: ['pipe', 'ignore', 'ignore'] });
      child.on('error', () => resolve(false));
      child.on('exit', (code) => resolve(code === 0));
      child.stdin.on('error', () => undefined);
      child.stdin.end(text);
    });
    if (ok) return;
  }
  await clipboard.writeText(text);
}

export async function clearClipboard(): Promise<void> {
  if (useWlClipboard()) {
    const r = await run(findCommand('wl-copy')!, ['--clear'], { timeoutMs: 1500 });
    if (r.code === 0) return;
  }
  clipboard.clear();
}

export function clipboardBackendName(): string {
  return useWlClipboard() ? 'wl-clipboard' : 'electron';
}

// ---------- Login item / autostart ----------

const LINUX_DESKTOP_ID = 'com.clipboardfilter.app';

function linuxAutostartFile(): string {
  const configHome = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
  return path.join(configHome, 'autostart', `${LINUX_DESKTOP_ID}.desktop`);
}

function desktopExecQuote(arg: string): string {
  // Desktop Entry spec: quote arguments containing reserved characters
  if (/^[A-Za-z0-9_\-./=:@%+,]+$/.test(arg)) return arg;
  return `"${arg.replace(/(["`$\\])/g, '\\$1')}"`;
}

export function getLaunchCommand(extraArgs: string[] = []): string[] {
  if (process.env.APPIMAGE) return [process.env.APPIMAGE, ...extraArgs];
  if (app.isPackaged) return [process.execPath, ...extraArgs];
  return [process.execPath, app.getAppPath(), ...extraArgs];
}

export function setAutoStart(enabled: boolean): void {
  try {
    if (process.platform === 'linux') {
      const file = linuxAutostartFile();
      if (!enabled) {
        if (fs.existsSync(file)) fs.unlinkSync(file);
        return;
      }
      const exec = getLaunchCommand(['--hidden']).map(desktopExecQuote).join(' ');
      const content = [
        '[Desktop Entry]',
        'Type=Application',
        'Name=ClipboardFilter',
        'Comment=Secure clipboard filtering tool',
        `Exec=${exec}`,
        'Icon=clipboardfilter',
        'Terminal=false',
        'X-GNOME-Autostart-enabled=true',
        'X-KDE-autostart-after=panel',
        ''
      ].join('\n');
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, content, { mode: 0o644 });
    } else if (process.platform === 'win32' || process.platform === 'darwin') {
      app.setLoginItemSettings({
        openAtLogin: enabled,
        path: process.platform === 'win32' ? process.execPath : undefined,
        args: process.platform === 'win32' ? ['--hidden'] : undefined
      });
    }
  } catch (error) {
    console.error('[Platform] Failed to update autostart:', error);
  }
}

/** True when the app was started by the OS at login. */
export function wasOpenedAtLogin(argv: string[]): boolean {
  if (argv.includes('--hidden')) return true;
  if (process.platform === 'darwin') {
    try { return app.getLoginItemSettings().wasOpenedAtLogin === true; } catch { return false; }
  }
  return false;
}
