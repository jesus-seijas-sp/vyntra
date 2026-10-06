const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { runFixture } = require('./helpers/run-fixture');

const BIN = path.join(__dirname, '..', 'bin', 'vyntra.js');
const run = (...args) =>
  spawnSync(process.execPath, [BIN, '--root', path.join(__dirname, 'fixtures', 'flaky'), '--no-color', ...args], {
    encoding: 'utf8',
    env: { ...process.env, CI: '' },
  });

describe('flaky tests', () => {
  it('keeps the failures of every attempt of a test that never passed', () => {
    const { tests } = runFixture('flaky', ['flaky.test.js']);
    expect(tests['never passes'].status).toBe('failed');
    expect(tests['never passes'].attempts).toHaveLength(2);
    expect(tests['never passes'].errors).toHaveLength(1);
  });

  it('counts flaky tests apart and lists them with why they failed first', () => {
    const { stdout } = run('steady.test.js');
    expect(stdout).toContain('Tests  1 flaky (1)');
    expect(stdout).toContain('Test Files  1 passed (1)');
    expect(stdout).toContain('FLAKY  steady.test.js > passes on the second attempt (passed on attempt 2)');
    expect(stdout).toMatch(/attempt 1: AssertionError: .*\n +Expected: 2\n +Received: 1/);
  });

  it('passes a run with flaky tests, unless --fail-on-flaky', () => {
    expect(run('steady.test.js').status).toBe(0);
    expect(run('steady.test.js', '--fail-on-flaky').status).toBe(1);
    expect(runFixture('flaky', ['steady.test.js', '--fail-on-flaky']).success).toBe(false);
  });
});
