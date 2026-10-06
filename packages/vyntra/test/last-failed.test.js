const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { copyFixture } = require('./helpers/run-fixture');
const { owedAfter } = require('../src/cli/last-run');

const BIN = path.join(__dirname, '..', 'bin', 'vyntra.js');

// The fixture's a.test.js and c.test.js fail (c does not even load) until FIX=1.
function project() {
  const dir = copyFixture('last-failed');
  const run = (args = [], env = {}) => {
    const { status, stdout } = spawnSync(process.execPath, [BIN, '--root', dir, '--no-color', ...args], {
      encoding: 'utf8',
      env: { ...process.env, CI: '', FIX: '', ...env },
    });
    const report = JSON.parse(fs.readFileSync(path.join(dir, '.vyntra', 'report.json'), 'utf8'));
    const owed = report.owed.map(({ file, test }) => (test ? `${file}: ${test.join(' > ')}` : file)).sort();
    return { status, stdout, report, owed };
  };
  return { dir, run };
}

const FAILURES = ['a.test.js: also breaks', 'a.test.js: math > breaks', 'c.test.js'];

describe('--last-failed', () => {
  it('writes a report of every run, with what still fails', () => {
    const { report, owed, status } = project().run();
    expect(status).toBe(2);
    expect(owed).toEqual(FAILURES);
    expect(report.exitCode).toBe(2);
    expect(report.files.map((file) => file.path).sort()).toEqual(['a.test.js', 'b.test.js', 'c.test.js']);
  });

  it('reruns only the failed tests, and the files that did not load', () => {
    const { run } = project();
    run();
    const { stdout, report } = run(['--last-failed']);
    expect(stdout).toContain('running 2 test files (last failed: 2 tests, 1 file)');
    const statuses = Object.fromEntries(
      report.files.flatMap((file) => file.tests.map((test) => [`${file.path}: ${test.path.join(' > ')}`, test.status]))
    );
    expect(statuses).toEqual({
      'a.test.js: math > adds': 'skipped',
      'a.test.js: math > breaks': 'failed',
      'a.test.js: also breaks': 'failed',
    });
  });

  it('forgets a failure once its test passes', () => {
    const { run } = project();
    run();
    const fixed = run(['--last-failed'], { FIX: '1' });
    expect(fixed.status).toBe(0);
    expect(fixed.owed).toEqual([]);
    const again = run(['--last-failed']);
    expect(again.stdout).toContain('No failed tests to rerun');
    expect(again.status).toBe(0);
  });

  it('keeps owing what a filter left out', () => {
    const { run } = project();
    run();
    expect(run(['b.test.js']).owed).toEqual(FAILURES);
    expect(run(['-t', 'also'], { FIX: '1' }).owed).toEqual(['a.test.js: math > breaks', 'c.test.js: loads']);
    expect(run(['--last-failed'], { FIX: '1' }).owed).toEqual([]);
  });

  it('runs every test when there is no report yet', () => {
    const { dir } = project();
    const { stdout } = spawnSync(process.execPath, [BIN, '--root', dir, '--no-color', '--last-failed'], {
      encoding: 'utf8',
      env: { ...process.env, CI: '', FIX: '1' },
    });
    expect(stdout).toContain('No report of an earlier run: running every test');
    expect(stdout).toContain('running 3 test files');
  });

  it('writes no report with outputDir: false', () => {
    const { dir } = project();
    fs.writeFileSync(path.join(dir, 'vyntra.config.js'), 'module.exports = { outputDir: false };\n');
    spawnSync(process.execPath, [BIN, '--root', dir], { env: { ...process.env, CI: '' } });
    expect(fs.existsSync(path.join(dir, '.vyntra'))).toBe(false);
  });
});

describe('owedAfter', () => {
  const root = path.join(__dirname, 'fixtures', 'last-failed');
  const result = (file, tests, errors = []) => ({ path: path.join(root, file), tests, errors });
  const test = (name, status, extra = {}) => ({ path: [name], status, ...extra });

  it('drops failures of files and tests that no longer exist', () => {
    const previous = [
      { file: 'gone.test.js', test: ['x'] },
      { file: 'b.test.js', test: ['renamed'] },
    ];
    expect(owedAfter(previous, [result('b.test.js', [test('fine', 'passed')])], root)).toEqual([]);
  });

  it('drops a failure of a test skipped in the code, keeps one a filter skipped', () => {
    const previous = [
      { file: 'b.test.js', test: ['skipped'] },
      { file: 'b.test.js', test: ['filtered'] },
    ];
    const tests = [test('skipped', 'skipped'), test('filtered', 'skipped', { filtered: true })];
    expect(owedAfter(previous, [result('b.test.js', tests)], root)).toEqual([
      { file: 'b.test.js', test: ['filtered'] },
    ]);
  });

  it('keeps the failed tests of a file that stopped loading', () => {
    const previous = [{ file: 'b.test.js', test: ['fine'] }];
    const owed = owedAfter(previous, [result('b.test.js', [], [{ message: 'boom' }])], root);
    expect(owed).toEqual([
      { file: 'b.test.js', test: ['fine'] },
      { file: 'b.test.js', test: null },
    ]);
  });
});
