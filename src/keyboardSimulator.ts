// ==================================================
// CLIPBOARDFILTER - Keyboard simulation (paste)
// Sends the platform "paste" keystroke to the focused application.
//
//  - Windows : persistent PowerShell helper (no process spawn per paste),
//              waits for the user to release the hotkey modifiers first.
//  - macOS   : osascript / System Events (needs Accessibility permission).
//  - Linux   : X11 -> xdotool ; Wayland -> ydotool, dotool, wtype, then
//              xdotool (XWayland windows only). Commands are executed
//              without a shell.
// ==================================================

import { app, systemPreferences } from 'electron';
import { ChildProcessWithoutNullStreams, spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { findCommand, getSessionInfo, run } from './platform';

export interface PasteOutcome {
  ok: boolean;
  backend: string | null;
  /** false when the backend may silently fail (e.g. xdotool on Wayland) */
  reliable: boolean;
}

interface Backend {
  name: string;
  reliable: boolean;
  available: () => boolean;
  paste: () => Promise<boolean>;
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// ---------- Windows ----------

const WINDOWS_HELPER = String.raw`
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using System.Threading;
public static class CFPaste {
  [DllImport("user32.dll")] private static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);
  [DllImport("user32.dll")] private static extern short GetAsyncKeyState(int vKey);
  private const uint KEYUP = 0x0002;
  private static readonly int[] Modifiers = { 0x10, 0x11, 0x12, 0x5B, 0x5C };
  private static bool AnyModifierDown() {
    foreach (int vk in Modifiers) { if ((GetAsyncKeyState(vk) & 0x8000) != 0) return true; }
    return false;
  }
  public static void Paste(int maxWaitMs) {
    int waited = 0;
    while (AnyModifierDown() && waited < maxWaitMs) { Thread.Sleep(10); waited += 10; }
    keybd_event(0x11, 0, 0, UIntPtr.Zero);
    keybd_event(0x56, 0, 0, UIntPtr.Zero);
    keybd_event(0x56, 0, KEYUP, UIntPtr.Zero);
    keybd_event(0x11, 0, KEYUP, UIntPtr.Zero);
  }
}
'@
[Console]::Out.WriteLine('READY')
[Console]::Out.Flush()
while ($true) {
  $line = [Console]::In.ReadLine()
  if ($null -eq $line -or $line -eq 'exit') { break }
  if ($line -eq 'paste') {
    [CFPaste]::Paste(1500)
    [Console]::Out.WriteLine('OK')
    [Console]::Out.Flush()
  }
}
`;

class WindowsPasteHelper {
  private proc: ChildProcessWithoutNullStreams | null = null;
  private ready: Promise<boolean> | null = null;
  private buffer = '';
  private waiters: Array<(line: string) => void> = [];

  public start(): Promise<boolean> {
    if (this.ready) return this.ready;
    this.ready = new Promise<boolean>((resolve) => {
      try {
        const dir = app.getPath('userData');
        fs.mkdirSync(dir, { recursive: true });
        const scriptPath = path.join(dir, 'paste-helper.ps1');
        fs.writeFileSync(scriptPath, WINDOWS_HELPER, 'utf-8');
        const proc = spawn('powershell.exe', [
          '-NoProfile', '-NoLogo', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', scriptPath
        ], { windowsHide: true });
        this.proc = proc;
        const timer = setTimeout(() => resolve(false), 15000);
        proc.stdout.setEncoding('utf8');
        proc.stdout.on('data', (chunk: string) => {
          this.buffer += chunk;
          let idx: number;
          while ((idx = this.buffer.indexOf('\n')) !== -1) {
            const line = this.buffer.slice(0, idx).trim();
            this.buffer = this.buffer.slice(idx + 1);
            if (line === 'READY') { clearTimeout(timer); resolve(true); continue; }
            const w = this.waiters.shift();
            if (w) w(line);
          }
        });
        proc.stderr.on('data', (d) => console.error('[Paste helper]', String(d).trim()));
        proc.on('error', () => { clearTimeout(timer); resolve(false); this.reset(); });
        proc.on('exit', () => { clearTimeout(timer); resolve(false); this.reset(); });
        proc.stdin.on('error', () => undefined);
      } catch (error) {
        console.error('[Paste helper] Failed to start:', error);
        resolve(false);
      }
    });
    return this.ready;
  }

  public async paste(): Promise<boolean> {
    if (!(await this.start()) || !this.proc) return false;
    return new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => {
        const i = this.waiters.indexOf(onLine);
        if (i !== -1) this.waiters.splice(i, 1);
        resolve(false);
      }, 4000);
      const onLine = (line: string) => { clearTimeout(timer); resolve(line === 'OK'); };
      this.waiters.push(onLine);
      this.proc!.stdin.write('paste\n');
    });
  }

  public stop(): void {
    try { this.proc?.stdin.write('exit\n'); } catch { /* ignore */ }
    try { this.proc?.kill(); } catch { /* ignore */ }
    this.reset();
  }

  private reset(): void {
    this.proc = null;
    this.ready = null;
    this.buffer = '';
    const waiters = this.waiters;
    this.waiters = [];
    waiters.forEach(w => w('ERROR'));
  }
}

const windowsHelper = new WindowsPasteHelper();

async function windowsSendKeysFallback(): Promise<boolean> {
  const r = await run('powershell.exe', [
    '-NoProfile', '-NonInteractive', '-Command',
    "$w = New-Object -ComObject wscript.shell; $w.SendKeys('^v')"
  ], { timeoutMs: 5000 });
  return r.code === 0;
}

// ---------- Linux ----------

function linuxBackends(): Backend[] {
  const session = getSessionInfo().session;
  const xdotool: Backend = {
    name: 'xdotool',
    // On Wayland xdotool only reaches XWayland windows and cannot report failure.
    reliable: session === 'x11',
    available: () => !!findCommand('xdotool') && !!process.env.DISPLAY,
    paste: async () => (await run(findCommand('xdotool')!, ['key', '--clearmodifiers', 'ctrl+v'])).code === 0
  };
  const ydotool: Backend = {
    name: 'ydotool',
    reliable: true,
    available: () => !!findCommand('ydotool'),
    paste: async () => {
      const bin = findCommand('ydotool')!;
      // ydotool >= 1.0 uses keycodes (29 = LEFTCTRL, 47 = V)
      if ((await run(bin, ['key', '29:1', '47:1', '47:0', '29:0'])).code === 0) return true;
      // ydotool 0.1.x syntax
      return (await run(bin, ['key', 'ctrl+v'])).code === 0;
    }
  };
  const dotool: Backend = {
    name: 'dotool',
    reliable: true,
    available: () => !!findCommand('dotool'),
    paste: async () => (await run(findCommand('dotool')!, [], { input: 'key ctrl+v\n' })).code === 0
  };
  const wtype: Backend = {
    name: 'wtype',
    reliable: true,
    available: () => !!findCommand('wtype'),
    paste: async () => (await run(findCommand('wtype')!, ['-M', 'ctrl', '-k', 'v', '-m', 'ctrl'])).code === 0
  };

  if (session === 'x11') return [xdotool, ydotool, dotool];
  return [ydotool, dotool, wtype, xdotool];
}

// ---------- Public API ----------

export function listPasteBackends(): { name: string; available: boolean; reliable: boolean }[] {
  if (process.platform === 'win32') return [{ name: 'powershell', available: true, reliable: true }];
  if (process.platform === 'darwin') return [{ name: 'osascript', available: true, reliable: true }];
  return linuxBackends().map(b => ({ name: b.name, available: b.available(), reliable: b.reliable }));
}

/** Pre-starts slow helpers so that the first paste is instant. */
export function warmUpPaste(): void {
  if (process.platform === 'win32') windowsHelper.start().catch(() => undefined);
}

export function disposePaste(): void {
  if (process.platform === 'win32') windowsHelper.stop();
}

export function hasMacAccessibility(prompt: boolean): boolean {
  if (process.platform !== 'darwin') return true;
  try { return systemPreferences.isTrustedAccessibilityClient(prompt); } catch { return true; }
}

export async function simulatePaste(): Promise<PasteOutcome> {
  try {
    if (process.platform === 'win32') {
      if (await windowsHelper.paste()) return { ok: true, backend: 'powershell', reliable: true };
      const ok = await windowsSendKeysFallback();
      return { ok, backend: 'sendkeys', reliable: ok };
    }

    if (process.platform === 'darwin') {
      if (!hasMacAccessibility(true)) return { ok: false, backend: null, reliable: false };
      await sleep(80);
      const r = await run('osascript', ['-e', 'tell application "System Events" to keystroke "v" using command down'], { timeoutMs: 4000 });
      return { ok: r.code === 0, backend: 'osascript', reliable: r.code === 0 };
    }

    // Linux / BSD
    const wayland = getSessionInfo().session === 'wayland';
    if (wayland) {
      // Leave the user time to release the hotkey modifiers: they are still
      // physically held and would be combined with the simulated Ctrl+V.
      await sleep(150);
    }
    for (const backend of linuxBackends()) {
      if (!backend.available()) continue;
      if (await backend.paste()) return { ok: true, backend: backend.name, reliable: backend.reliable };
    }
    return { ok: false, backend: null, reliable: false };
  } catch (error) {
    console.error('[Paste] Failed to simulate paste:', error);
    return { ok: false, backend: null, reliable: false };
  }
}
