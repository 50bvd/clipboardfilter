const test = require('node:test');
const assert = require('node:assert/strict');
const { compareVersions, isPrerelease, parseVersion } = require('../dist/version');

test('semver ordering, including pre-releases', () => {
  const ordered = ['1.0.0', '1.1.0-alpha', '1.1.0-beta.1', '1.1.0-beta.2', '1.1.0-beta.10', '1.1.0-rc.1', '1.1.0', 'v1.1.1', '1.2.0', '2.0.0'];
  for (let i = 0; i < ordered.length - 1; i++) {
    assert.ok(compareVersions(ordered[i], ordered[i + 1]) < 0, `${ordered[i]} < ${ordered[i + 1]}`);
    assert.ok(compareVersions(ordered[i + 1], ordered[i]) > 0, `${ordered[i + 1]} > ${ordered[i]}`);
  }
  assert.equal(compareVersions('v1.1.0-beta.1', '1.1.0-beta.1'), 0);
});

test('invalid versions never look newer', () => {
  assert.ok(compareVersions('garbage', '0.0.1') < 0);
  assert.equal(parseVersion('1.2'), null);
});

test('isPrerelease', () => {
  assert.equal(isPrerelease('1.1.0-beta.1'), true);
  assert.equal(isPrerelease('1.1.0'), false);
});
