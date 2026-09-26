const test = require('node:test');
const assert = require('node:assert/strict');
const { FilterRunner, FilterTimeoutError } = require('../dist/filterRunner');

const rule = (id, pattern, replacement = 'X') => ({ id, pattern, replacement, useRegex: true, enabled: true });

test('filters in a worker thread', async () => {
  const runner = new FilterRunner();
  runner.setRules([rule('a', 'secret\\d+', '***')]);
  const r = await runner.filter('my secret42 and SECRET7', true);
  assert.equal(r.filtered, 'my *** and ***');
  assert.equal(r.count, 2);
  assert.deepEqual(r.details, [{ id: 'a', count: 2 }]);
  runner.dispose();
});

test('rule updates are applied to the next call', async () => {
  const runner = new FilterRunner();
  runner.setRules([rule('a', 'foo')]);
  assert.equal((await runner.filter('foo bar')).filtered, 'X bar');
  runner.setRules([rule('b', 'bar')]);
  assert.equal((await runner.filter('foo bar')).filtered, 'foo X');
  runner.dispose();
});

test('a catastrophic regex times out (fails closed) and the runner recovers', async () => {
  const runner = new FilterRunner(300);
  runner.setRules([rule('ok', 'foo'), rule('evil', '(a+)+$')]);
  const started = Date.now();
  await assert.rejects(runner.filter('a'.repeat(40) + '!'), (err) => {
    assert.ok(err instanceof FilterTimeoutError);
    assert.equal(err.ruleId, 'evil');
    return true;
  });
  assert.ok(Date.now() - started < 3000, 'timeout took too long');

  runner.setRules([rule('ok', 'foo')]);
  assert.equal((await runner.filter('foo')).filtered, 'X');
  runner.dispose();
});
