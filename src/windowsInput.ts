// ==================================================
// CLIPBOARDFILTER - Windows keyboard input (paste)
// Sends Ctrl+V with the Win32 SendInput API, called in-process through the
// koffi FFI library. No PowerShell, no script and no child process: security
// software (EDR) treats a PowerShell script compiling keyboard APIs as
// keylogger behavior.
// ==================================================

const VK_SHIFT = 0x10;
const VK_CONTROL = 0x11;
const VK_MENU = 0x12;
const VK_LWIN = 0x5b;
const VK_RWIN = 0x5c;
const VK_V = 0x56;
const INPUT_KEYBOARD = 1;
const KEYEVENTF_KEYUP = 0x0002;
const MODIFIERS = [VK_SHIFT, VK_CONTROL, VK_MENU, VK_LWIN, VK_RWIN];

interface Win32 {
  sendInput: (count: number, inputs: unknown[], size: number) => number;
  getAsyncKeyState: (vKey: number) => number;
  inputSize: number;
}

let api: Win32 | null | undefined;

/** Binds the user32 functions once. Returns null outside Windows or if koffi is missing. */
export function loadWin32(): Win32 | null {
  if (api !== undefined) return api;
  api = null;
  if (process.platform !== 'win32') return api;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const koffi = require('koffi');
    const user32 = koffi.load('user32.dll');
    const KEYBDINPUT = koffi.struct('CF_KEYBDINPUT', {
      wVk: 'uint16', wScan: 'uint16', dwFlags: 'uint32', time: 'uint32', dwExtraInfo: 'uintptr_t'
    });
    const MOUSEINPUT = koffi.struct('CF_MOUSEINPUT', {
      dx: 'int32', dy: 'int32', mouseData: 'uint32', dwFlags: 'uint32', time: 'uint32', dwExtraInfo: 'uintptr_t'
    });
    const HARDWAREINPUT = koffi.struct('CF_HARDWAREINPUT', { uMsg: 'uint32', wParamL: 'uint16', wParamH: 'uint16' });
    const INPUT = koffi.struct('CF_INPUT', {
      type: 'uint32',
      u: koffi.union('CF_INPUT_UNION', { mi: MOUSEINPUT, ki: KEYBDINPUT, hi: HARDWAREINPUT })
    });
    api = {
      sendInput: user32.func('uint32 __stdcall SendInput(uint32 cInputs, const CF_INPUT *pInputs, int cbSize)'),
      getAsyncKeyState: user32.func('int16 __stdcall GetAsyncKeyState(int vKey)'),
      inputSize: koffi.sizeof(INPUT)
    };
  } catch (error) {
    console.error('[Paste] Windows input API unavailable:', error);
  }
  return api;
}

function key(vk: number, up: boolean) {
  return { type: INPUT_KEYBOARD, u: { ki: { wVk: vk, wScan: 0, dwFlags: up ? KEYEVENTF_KEYUP : 0, time: 0, dwExtraInfo: 0 } } };
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/**
 * Waits until the user has released the hotkey modifiers (they would be
 * combined with the simulated Ctrl+V), then sends Ctrl+V.
 */
export async function windowsPaste(maxWaitMs = 1500): Promise<boolean> {
  const win = loadWin32();
  if (!win) return false;
  for (let waited = 0; waited < maxWaitMs; waited += 10) {
    if (!MODIFIERS.some(vk => (win.getAsyncKeyState(vk) & 0x8000) !== 0)) break;
    await sleep(10);
  }
  const inputs = [key(VK_CONTROL, false), key(VK_V, false), key(VK_V, true), key(VK_CONTROL, true)];
  return win.sendInput(inputs.length, inputs, win.inputSize) === inputs.length;
}
