// Compares the 1.0.0 filtering path with the current one.
// Usage: npm run bench
const fs = require('fs');
const os = require('os');
const path = require('path');
const { compileRules, applyRules } = require('../dist/filterEngine');
const { FilterRunner } = require('../dist/filterRunner');
const { bigText, legacyFilter } = require('../test/fixtures');

const filters = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'default-filters.json'), 'utf-8'))
  .filters.map((f, i) => ({ ...f, id: `d${i}` }));

// 1.0.0 read and parsed the whole electron-store file on every access
const configFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'cf-bench-')), 'config.json');
fs.writeFileSync(configFile, JSON.stringify({ filters, customFolders: [], settings: {} }, null, 2));

function time(label, runs, fn) {
  fn();
  const start = process.hrtime.bigint();
  for (let i = 0; i < runs; i++) fn();
  const ms = Number(process.hrtime.bigint() - start) / 1e6 / runs;
  console.log(`  ${label.padEnd(34)} ${ms.toFixed(3).padStart(9)} ms`);
  return ms;
}

async function timeAsync(label, runs, fn) {
  await fn();
  const start = process.hrtime.bigint();
  for (let i = 0; i < runs; i++) await fn();
  const ms = Number(process.hrtime.bigint() - start) / 1e6 / runs;
  console.log(`  ${label.padEnd(34)} ${ms.toFixed(3).padStart(9)} ms`);
  return ms;
}

(async () => {
  const runner = new FilterRunner();
  runner.setRules(filters);
  const compiled = compileRules(filters);

  const prose = 'The quick brown fox jumps over the lazy dog while the build pipeline compiles modules. ';
  const cases = [
    ...[2000, 20000, 200000].map(size => [size, bigText(size), 'full of secrets']),
    ...[2000, 200000].map(size => [size, prose.repeat(Math.ceil(size / prose.length)), 'no secrets'])
  ];
  for (const [size, text, kind] of cases) {
    const runs = size >= 200000 ? 5 : size >= 20000 ? 30 : 200;
    console.log(`\nClipboard of ${text.length} characters (${kind}):`);
    const legacy = time('1.0.0 (store read + compile + 2 passes)', runs, () => {
      const cfg = JSON.parse(fs.readFileSync(configFile, 'utf-8'));
      legacyFilter(cfg.filters, text);
    });
    const inProcess = time('1.1.0 engine (precompiled, 1 pass)', runs, () => applyRules(compiled, text));
    const worker = await timeAsync('1.1.0 via worker (as used by app)', runs, () => runner.filter(text));
    console.log(`  speed-up: x${(legacy / inProcess).toFixed(1)} engine, x${(legacy / worker).toFixed(1)} end-to-end (main thread stays free)`);
  }
  runner.dispose();
})();
