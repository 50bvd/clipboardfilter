const test = require('node:test');
const assert = require('node:assert/strict');
const { assetNameFor, parseChecksums, isTrustedDownloadUrl } = require('../dist/updateInstaller');

// Real file names of the v1.1.0-beta.2 and v1.1.1 releases
const RELEASE_FILES = [
  'ClipboardFilter.Setup.1.1.1.exe', 'ClipboardFilter.1.1.1.exe', 'ClipboardFilter-1.1.1.AppImage',
  'clipboard-filter_1.1.1_amd64.deb', 'clipboard-filter-1.1.1.x86_64.rpm', 'clipboard-filter-1.1.1.pacman',
  'ClipboardFilter-1.1.1-arm64.dmg', 'ClipboardFilter-1.1.1.dmg'
];

test('each install kind maps to a published release file', () => {
  const names = [
    assetNameFor('nsis', 'v1.1.1', 'x64'), assetNameFor('portable', '1.1.1', 'x64'),
    assetNameFor('appimage', '1.1.1', 'x64'), assetNameFor('deb', '1.1.1', 'x64'),
    assetNameFor('rpm', '1.1.1', 'x64'), assetNameFor('pacman', '1.1.1', 'x64'),
    assetNameFor('dmg', '1.1.1', 'arm64'), assetNameFor('dmg', '1.1.1', 'x64')
  ];
  assert.deepEqual(names, RELEASE_FILES);
  assert.equal(assetNameFor('nsis', '1.1.0-beta.2', 'x64'), 'ClipboardFilter.Setup.1.1.0-beta.2.exe');
  assert.equal(assetNameFor('deb', '1.1.0-beta.2', 'x64'), 'clipboard-filter_1.1.0-beta.2_amd64.deb');
  // No Linux arm64 builds are published
  assert.equal(assetNameFor('appimage', '1.1.1', 'arm64'), null);
  assert.equal(assetNameFor('deb', '1.1.1', 'arm64'), null);
});

test('SHA256SUMS.txt is parsed with GitHub file names', () => {
  const sums = parseChecksums([
    '3435a57d5793cfe93c3ff6b733bac3cdba394954e6fb084f742538a28d50e0a0  ClipboardFilter 1.1.1.exe',
    '1A351B1C0F99964E0A6AA1AA15E9B82A7A83A1CEF9FE99E2837CABCD0D77F566 *ClipboardFilter Setup 1.1.1.exe',
    'b1338913a9199d7f5feaac88cc6e996eec3f4c3f2aea77a1a1bc0831188172fb  ClipboardFilter-1.1.1.AppImage\r',
    'not a checksum line',
    'abc  short.txt'
  ].join('\n'));
  assert.equal(sums.size, 3);
  assert.equal(sums.get('ClipboardFilter.1.1.1.exe'), '3435a57d5793cfe93c3ff6b733bac3cdba394954e6fb084f742538a28d50e0a0');
  assert.equal(sums.get('ClipboardFilter.Setup.1.1.1.exe'), '1a351b1c0f99964e0a6aa1aa15e9b82a7a83a1cef9fe99e2837cabcd0d77f566');
  assert.equal(sums.get('ClipboardFilter-1.1.1.AppImage'), 'b1338913a9199d7f5feaac88cc6e996eec3f4c3f2aea77a1a1bc0831188172fb');
});

test('only release files of this repository can be downloaded', () => {
  assert.ok(isTrustedDownloadUrl('https://github.com/50bvd/clipboardfilter/releases/download/v1.1.1/ClipboardFilter-1.1.1.AppImage'));
  for (const bad of [
    'https://github.com/evil/clipboardfilter/releases/download/v1.1.1/x.exe',
    'http://github.com/50bvd/clipboardfilter/releases/download/v1.1.1/x.exe',
    'https://github.com/50bvd/clipboardfilter/releases/download/../../evil/x.exe',
    'https://github.com/50bvd/clipboardfilter/releases/download/v1/x.exe?redirect=evil',
    'https://github.com.evil.com/50bvd/clipboardfilter/releases/download/v1/x.exe',
    'https://github.com/50bvd/clipboardfilter/releases/tag/v1.1.1',
    null, 42
  ]) {
    assert.equal(isTrustedDownloadUrl(bad), false, String(bad));
  }
});
