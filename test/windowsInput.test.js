const test = require('node:test');
const assert = require('node:assert/strict');
const { loadWin32 } = require('../dist/windowsInput');

test('Windows paste binds SendInput without PowerShell', { skip: process.platform !== 'win32' && 'Windows only' }, () => {
  const win = loadWin32();
  assert.ok(win, 'user32 functions bound through koffi');
  // sizeof(INPUT) on 64-bit Windows; a wrong layout makes SendInput fail
  assert.equal(win.inputSize, process.arch === 'ia32' ? 28 : 40);
  assert.equal(typeof win.getAsyncKeyState(0x10), 'number');
  // Zero inputs: checks the call itself without typing anything
  assert.equal(win.sendInput(0, [], win.inputSize), 0);
});

test('Windows input API is not loaded on other systems', { skip: process.platform === 'win32' && 'not Windows' }, () => {
  assert.equal(loadWin32(), null);
});
