// ==================================================
// CLIPBOARDFILTER - Keyboard simulation (paste)
// Sends the platform "paste" keystroke to the focused application.
//
//  - Windows : SendInput API called in-process (windowsInput.ts), after the
//              user has released the hotkey modifiers. No PowerShell.
//  - macOS   : osascript / System Events (needs Accessibility permission).
//  - Linux   : X11 -> xdotool ; Wayland -> ydotool, dotool, wtype, then
//              xdotool (XWayland windows only). Commands are executed
//              without a shell.
// ==================================================

import { systemPreferences } from 'electron';
import { findCommand, getSessionInfo, run } from './platform';
import { loadWin32, windowsPaste } from './windowsInput';

const OSASCRIPT = '/usr/bin/osascript';

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
  if (process.platform === 'win32') return [{ name: 'sendinput', available: !!loadWin32(), reliable: true }];
  if (process.platform === 'darwin') return [{ name: 'osascript', available: true, reliable: true }];
  return linuxBackends().map(b => ({ name: b.name, available: b.available(), reliable: b.reliable }));
}

/** Pre-starts slow helpers so that the first paste is instant. */
export function warmUpPaste(): void {
  if (process.platform === 'win32') loadWin32();
}

export function disposePaste(): void {
  /* nothing to release */
}

export function hasMacAccessibility(prompt: boolean): boolean {
  if (process.platform !== 'darwin') return true;
  try { return systemPreferences.isTrustedAccessibilityClient(prompt); } catch { return true; }
}

export async function simulatePaste(): Promise<PasteOutcome> {
  try {
    if (process.platform === 'win32') {
      const ok = await windowsPaste();
      return { ok, backend: ok ? 'sendinput' : null, reliable: ok };
    }

    if (process.platform === 'darwin') {
      if (!hasMacAccessibility(true)) return { ok: false, backend: null, reliable: false };
      await sleep(80);
      const r = await run(OSASCRIPT, ['-e', 'tell application "System Events" to keystroke "v" using command down'], { timeoutMs: 4000 });
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
