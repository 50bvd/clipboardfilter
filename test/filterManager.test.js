const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { FilterManager, ValidationError } = require('../dist/filterManager');
const { JsonStore } = require('../dist/store');

const DEFAULTS = path.join(__dirname, '..', 'default-filters.json');
const LOCALES = ['de', 'en', 'es', 'fr', 'it'];

function tmpConfig(content) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-test-'));
  const file = path.join(dir, 'config.json');
  if (content !== undefined) fs.writeFileSync(file, typeof content === 'string' ? content : JSON.stringify(content));
  return file;
}

test('first run loads the 112 default filters and persists them', () => {
  const file = tmpConfig();
  const fm = new FilterManager(file, DEFAULTS, LOCALES);
  assert.equal(fm.getFilters().length, 112);
  fm.flush();
  const saved = JSON.parse(fs.readFileSync(file, 'utf-8'));
  assert.equal(saved.filters.length, 112);
  assert.equal(saved.settings.shortcutPaste, 'CommandOrControl+Shift+V');
});

test('keeps an existing electron-store configuration and fixes broken 1.0.0 patterns', () => {
  const old = JSON.parse(fs.readFileSync(path.join(__dirname, 'legacy-default-filters.json'), 'utf-8'));
  const file = tmpConfig({
    filters: old.filters.map((f, i) => ({ ...f, id: `id${i}` })),
    customFolders: [{ id: 'f1', name: 'Work', icon: '💼' }],
    settings: { language: 'fr', autoStart: false, notifications: false, theme: 'dark', shortcutPaste: 'CommandOrControl+Alt+V' }
  });
  const fm = new FilterManager(file, DEFAULTS, LOCALES);
  const byKey = Object.fromEntries(fm.getFilters().map(f => [f.descriptionKey, f]));
  const current = JSON.parse(fs.readFileSync(DEFAULTS, 'utf-8')).filters;
  for (const f of current) assert.equal(byKey[f.descriptionKey].pattern, f.pattern, f.descriptionKey);
  const s = fm.getSettings();
  assert.equal(s.language, 'fr');
  assert.equal(s.theme, 'dark');
  assert.equal(s.shortcutPaste, 'CommandOrControl+Alt+V');
  assert.equal(s.pasteMode, 'simulate');
  assert.equal(fm.getCustomFolders()[0].name, 'Work');
});

test('rejects invalid filters and settings from the renderer', () => {
  const fm = new FilterManager(tmpConfig(), DEFAULTS, LOCALES);
  assert.throws(() => fm.addFilter({ description: 'x', pattern: '(', useRegex: true }), ValidationError);
  assert.throws(() => fm.addFilter({ description: 'x', pattern: '.*', useRegex: true }), /emptyMatch/);
  assert.throws(() => fm.addFilter({ pattern: 'abc' }), /descriptionRequired/);
  const f = fm.addFilter({ description: '  <b>x</b>\u0000 ', pattern: 'abc', replacement: 'X', folder: 'nope', __proto__: { polluted: true } });
  assert.equal(f.description, '<b>x</b>');
  assert.equal(f.folder, undefined);
  assert.equal(Object.keys(f).includes('polluted'), false);

  const s = fm.updateSettings({ theme: 'evil', language: '../../etc', shortcutPaste: 'Ctrl+"; rm', clearClipboardSeconds: 1e9, autoFilter: true });
  assert.equal(s.theme, 'auto');
  assert.equal(s.language, 'en');
  assert.equal(s.shortcutPaste, 'CommandOrControl+Shift+V');
  assert.equal(s.clearClipboardSeconds, 3600);
  assert.equal(s.autoFilter, true);
});

test('bulk operations, import and data management', () => {
  const fm = new FilterManager(tmpConfig(), DEFAULTS, LOCALES);
  let changes = 0;
  fm.onRulesChanged(() => changes++);
  const ids = fm.getFilters().filter(f => f.category === 'Finance').map(f => f.id);
  fm.setFiltersEnabled(ids, false);
  assert.equal(fm.getFilters().filter(f => f.category === 'Finance' && f.enabled).length, 0);

  const r = fm.addFilters([
    { description: 'ok', pattern: 'abc', category: 'Imported' },
    { description: 'bad', pattern: '(', useRegex: true },
    'garbage'
  ]);
  assert.deepEqual(r, { added: 1, skipped: 2 });

  const folder = fm.addCustomFolder({ name: 'Work', icon: '💼' });
  fm.copyFilterToFolder(ids[0], folder.id);
  assert.equal(fm.getFilters().filter(f => f.folder === folder.id).length, 1);

  fm.deleteFilters([ids[1]]);
  assert.equal(fm.resetDefaults(), 112);
  assert.equal(fm.getFilters().filter(f => f.descriptionKey && !f.folder).length, 112);
  assert.ok(fm.getFilters().filter(f => f.descriptionKey && !f.folder).every(f => f.enabled));

  const removed = fm.deleteAllCustom();
  assert.deepEqual(removed, { filters: 2, folders: 1 });
  assert.equal(fm.getFilters().length, 112);
  assert.ok(changes >= 5);
});

test('store writes atomically and backs up a corrupted file', () => {
  const file = tmpConfig('{ not json');
  const store = new JsonStore(file, { a: 1 });
  assert.equal(store.get('a'), 1);
  assert.ok(fs.readdirSync(path.dirname(file)).some(n => n.includes('.corrupt-')));
  store.set('a', 2);
  store.flush();
  assert.equal(JSON.parse(fs.readFileSync(file, 'utf-8')).a, 2);
  if (process.platform !== 'win32') assert.equal(fs.statSync(file).mode & 0o777, 0o600);
});

test('every previously shipped default pattern is migrated to the current one', () => {
  const { PATTERN_MIGRATIONS, REPLACEMENT_MIGRATIONS } = require('../dist/filterManager');
  const current = JSON.parse(fs.readFileSync(DEFAULTS, 'utf-8')).filters;
  const byKeyCurrent = Object.fromEntries(current.map(f => [f.descriptionKey, f]));
  for (const [key, m] of Object.entries(PATTERN_MIGRATIONS)) {
    assert.equal(m.to, byKeyCurrent[key].pattern, `${key}: migration target is the shipped pattern`);
    for (const old of m.from) {
      const file = tmpConfig({ filters: current.map((f, i) => ({ ...f, id: `id${i}`, ...(f.descriptionKey === key ? { pattern: old, caseSensitive: undefined } : {}) })) });
      const migrated = new FilterManager(file, DEFAULTS, LOCALES).getFilters().find(f => f.descriptionKey === key);
      assert.equal(migrated.pattern, byKeyCurrent[key].pattern, key);
      assert.equal(!!migrated.caseSensitive, !!byKeyCurrent[key].caseSensitive, `${key} case sensitivity`);
    }
  }
  for (const [key, m] of Object.entries(REPLACEMENT_MIGRATIONS)) {
    assert.equal(m.to, byKeyCurrent[key].replacement, key);
    const file = tmpConfig({ filters: current.map((f, i) => ({ ...f, id: `id${i}`, ...(f.descriptionKey === key ? { replacement: m.from } : {}) })) });
    const migrated = new FilterManager(file, DEFAULTS, LOCALES).getFilters().find(f => f.descriptionKey === key);
    assert.equal(migrated.replacement, m.to, key);
  }
});

test('an edited default filter is never migrated', () => {
  const current = JSON.parse(fs.readFileSync(DEFAULTS, 'utf-8')).filters;
  const custom = 'community[:=]custom';
  const file = tmpConfig({ filters: current.map((f, i) => ({ ...f, id: `id${i}`, ...(f.descriptionKey === 'filters.system.snmpCommunity' ? { pattern: custom } : {}) })) });
  const f = new FilterManager(file, DEFAULTS, LOCALES).getFilters().find(x => x.descriptionKey === 'filters.system.snmpCommunity');
  assert.equal(f.pattern, custom);
});

test('broad filters are applied after the specific ones', () => {
  const { inMatchOrder } = require('../dist/filterManager');
  const keys = inMatchOrder(JSON.parse(fs.readFileSync(DEFAULTS, 'utf-8')).filters).map(f => f.descriptionKey);
  assert.ok(keys.indexOf('filters.finance.creditCard') < keys.indexOf('filters.finance.nirFrance'));
  assert.ok(keys.indexOf('filters.developer.postgresql') < keys.indexOf('filters.system.unixPath'));
  assert.ok(keys.indexOf('filters.finance.bitcoin') < keys.indexOf('filters.developer.azureClientSecret'));
  assert.equal(keys.length, 112);
});
