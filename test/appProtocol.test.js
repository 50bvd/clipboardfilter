const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { resolveAppPath } = require('../dist/appProtocol');

const ROOT = path.join(__dirname, '..');

test('app:// serves only dist/ and assets/ files of the bundle', () => {
  assert.equal(resolveAppPath('/dist/renderer.html'), path.join(ROOT, 'dist', 'renderer.html'));
  assert.equal(resolveAppPath('/assets/icon.png'), path.join(ROOT, 'assets', 'icon.png'));
  for (const bad of [
    '/../../etc/passwd', '/dist/../package.json', '/dist/%2e%2e/%2e%2e/etc/passwd', '/locales/en.json',
    '/dist', '/dist/', '/dist/main.js.map', '/dist/x%00.html', '/dist/%E0%A4%A', '/assets/../src/main.ts', '/etc/passwd'
  ]) {
    assert.equal(resolveAppPath(bad), null, bad);
  }
});
