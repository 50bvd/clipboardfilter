const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const { compileRules, applyRules, validatePattern, filterOnce } = require('../dist/filterEngine');
const { SAMPLE, bigText, legacyFilter } = require('./fixtures');

const defaults = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'default-filters.json'), 'utf-8'))
  .filters.map((f, i) => ({ ...f, id: `d${i}` }));

const rule = (pattern, replacement, useRegex = true, id = 'r') => ({ id, pattern, replacement, useRegex, enabled: true });

test('default filters are all valid and never match the empty string', () => {
  for (const f of defaults) {
    assert.equal(validatePattern(f.pattern, f.useRegex), null, f.descriptionKey);
  }
});

const legacyDefaults = JSON.parse(fs.readFileSync(path.join(__dirname, 'legacy-default-filters.json'), 'utf-8'))
  .filters.map((f, i) => ({ ...f, id: `l${i}` }));

test('same output as the 1.0.0 engine on the 1.0.0 default filters', () => {
  for (const text of [SAMPLE, bigText(20000), 'nothing sensitive here', '']) {
    const legacy = legacyFilter(legacyDefaults, text);
    const current = filterOnce(legacyDefaults, text);
    assert.equal(current.filtered, legacy.filtered);
    assert.equal(current.count, legacy.count);
  }
});

test('secrets are actually masked', () => {
  const { filtered, count } = filterOnce(defaults, SAMPLE);
  assert.ok(count > 10);
  for (const secret of ['sk-proj-abcdefghijklmnop', 'AKIAIOSFODNN7EXAMPLE', 'ghp_abcdefghijklmnop', 'hunter2', 'jane.doe@example.com', '4111111111111111']) {
    assert.ok(!filtered.includes(secret), `${secret} leaked`);
  }
});

test('details report per-filter counts', () => {
  const set = compileRules([rule('foo', 'X', false, 'a'), rule('ba[rz]', 'Y', true, 'b'), rule('nope', 'Z', false, 'c')]);
  const r = applyRules(set, 'foo bar baz FOO', true);
  assert.equal(r.filtered, 'X Y Y X');
  assert.equal(r.count, 4);
  assert.deepEqual(r.details, [{ id: 'a', count: 2 }, { id: 'b', count: 2 }]);
});

test('regex replacement templates behave like String.replace', () => {
  const cases = [
    ['(\\w+)@(\\w+)\\.com', '$2 at $1', 'mail bob@corp.com now'],
    ['(?<user>\\w+)@(?<host>\\w+)', '$<host>/$<user>', 'bob@corp'],
    ['secret', '[$&]', 'my secret'],
    ['x', '$$', 'axb'],
    ['b', "<$`|$'>", 'abc'],
    ['(a)', '$2$1', 'a'],
    ['(a)(b)(c)(d)(e)(f)(g)(h)(i)(j)(k)', '$11-$1', 'abcdefghijk']
  ];
  for (const [pattern, replacement, input] of cases) {
    const expected = input.replace(new RegExp(pattern, 'gi'), replacement);
    assert.equal(filterOnce([rule(pattern, replacement)], input).filtered, expected, `${pattern} / ${replacement}`);
  }
});

test('literal filters are case-insensitive, escaped and use the replacement verbatim', () => {
  const r = filterOnce([rule('a.b(c)', '$&$1', false)], 'A.B(C) axb(c)');
  assert.equal(r.filtered, '$&$1 axb(c)');
  assert.equal(r.count, 1);
});

test('validatePattern rejects invalid, empty-matching and oversized patterns', () => {
  assert.equal(validatePattern('(', true), 'invalidRegex');
  assert.equal(validatePattern('a*', true), 'emptyMatch');
  assert.equal(validatePattern('', true), 'patternRequired');
  assert.equal(validatePattern('x'.repeat(5000), false), 'patternTooLong');
  assert.equal(validatePattern('a*', false), null);
});

test('case-sensitive filters', () => {
  const r = filterOnce([{ ...rule('AKIA[0-9]{4}', 'X'), caseSensitive: true }], 'AKIA1234 akia1234');
  assert.equal(r.filtered, 'X akia1234');
  const swift = defaults.find(f => f.descriptionKey === 'filters.finance.swift');
  assert.equal(filterOnce([swift], 'BIC BNPAFRPPXXX, DEUTDEFF').count, 2);
  assert.equal(filterOnce([swift], 'REDACTED PASSWORD Security Contract bnpafrppxxx').count, 0);
});

test('invalid or disabled rules are skipped, not fatal', () => {
  const set = compileRules([rule('(', 'X', true, 'bad'), { ...rule('a', 'X'), enabled: false }, rule('b', 'Y', true, 'ok')]);
  assert.deepEqual(set.errors, [{ id: 'bad', error: 'invalidRegex' }]);
  assert.equal(applyRules(set, 'ab').filtered, 'aY');
});

test('requiredLiteral extracts only literals that every match contains', () => {
  const { requiredLiteral } = require('../dist/filterEngine');
  const cases = {
    'sk-ant-[a-z]{90,}': 'sk-ant-',
    '[a-z0-9._%+-]+@[a-z.-]+\\.[a-z]{2,}': '@',
    'https://discord(?:app)?\\.com/api': 'https://discord',
    'abc|def': null,
    '(?:abc|def)ghi': 'ghi',
    'ab?c': 'a',
    'ab*cd': 'cd',
    'ab{0,2}cd': 'cd',
    'x+yz': 'yz',
    '\\u0041BC': 'BC',
    '\\x41BC': 'BC',
    '(a)\\1234': null,
    '(?<n>a)\\k<n>zz': 'zz',
    '\\012abc': 'abc',
    'AIza[0-9]': 'AIza',
    'a{b': null,
    '€uro': 'uro',
    '[a-z]{32}': null
  };
  for (const [source, expected] of Object.entries(cases)) {
    assert.equal(requiredLiteral(source), expected, source);
  }
});

test('fuzz: the literal pre-check never skips a regex that would match', () => {
  const { requiredLiteral } = require('../dist/filterEngine');
  let seed = 42;
  const rand = (n) => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % n; };
  const atoms = ['a', 'B', '-', '.', '\\.', '\\d', '\\w', '[a-c]', '(?:ab|c)', '(x)', '\\1', '\\x41', '\\u0062', 'é', '\\s', '_', ':', '@'];
  const quants = ['', '', '', '?', '*', '+', '{2}', '{0,2}', '{1,3}', '+?'];
  const alphabet = 'aAbBcCxX-._:@1 éK';
  let checked = 0;
  for (let n = 0; n < 3000; n++) {
    let source = '';
    for (let k = 1 + rand(6); k > 0; k--) source += atoms[rand(atoms.length)] + quants[rand(quants.length)];
    let regex;
    try { regex = new RegExp(source, 'gi'); } catch { continue; }
    const required = requiredLiteral(source);
    if (!required) continue;
    for (let m = 0; m < 20; m++) {
      let text = '';
      for (let k = rand(14); k > 0; k--) text += alphabet[rand(alphabet.length)];
      text += source.replace(/\\./g, '').replace(/[^a-z@:._-]/gi, ''); // bias towards matches
      regex.lastIndex = 0;
      const match = regex.exec(text);
      if (match && match[0] !== '') {
        checked++;
        assert.ok(match[0].toLowerCase().includes(required.toLowerCase()), `${source} matched "${match[0]}" without "${required}"`);
      }
    }
  }
  assert.ok(checked > 500, `only ${checked} matches checked`);
});
