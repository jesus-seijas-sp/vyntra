const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { runFixture } = require('./helpers/run-fixture');
const { statistics, measure } = require('../src/bench/measure');

const BIN = path.join(__dirname, '..', 'bin', 'vyntra.js');
const ROOT = path.join(__dirname, 'fixtures', 'bench');
const bench = (...args) =>
  spawnSync(process.execPath, [BIN, 'bench', '--root', ROOT, '--no-color', ...args], {
    encoding: 'utf8',
    env: { ...process.env, CI: '', GITHUB_ACTIONS: '' },
  });

describe('vyntra bench', () => {
  it('runs the benchmark files, each bench measured', () => {
    const { tests } = runFixture('bench', ['--bench']);
    expect(Object.keys(tests).sort()).toEqual([
      'async',
      'sorting > Array#sort',
      'sorting > Float64Array#sort',
      'sorting > skipped',
    ]);
    const { bench: stats } = tests['sorting > Array#sort'];
    expect(stats).toMatchObject({ hz: expect.any(Number), mean: expect.any(Number), samples: expect.any(Number) });
    expect(stats.samples).toBeGreaterThanOrEqual(10);
    expect(stats.min).toBeLessThanOrEqual(stats.p75);
    expect(stats.p75).toBeLessThanOrEqual(stats.max);
    expect(tests['sorting > skipped'].status).toBe('skipped');
  });

  it('leaves benchmark files out of a test run, and test files out of a bench run', () => {
    expect(Object.keys(runFixture('bench').tests)).toEqual(['is not a benchmark']);
  });

  it('prints a table per group and the fastest of each, saves the results and compares with them', () => {
    const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'vyntra-bench-')), 'bench.json');
    const first = bench('--outputJson', out);
    expect(first.status).toBe(0);
    expect(first.stdout).toMatch(/name +hz +min +max +mean +p75 +p99 +p995 +p999 +rme +samples/);
    expect(first.stdout).toMatch(/BENCH Summary\n\n {2}\S+ - sort\.bench\.js > sorting\n {4}[\d.,]+x faster than /);
    const saved = JSON.parse(fs.readFileSync(out, 'utf8'));
    expect(Object.keys(saved.benchmarks)).toEqual(
      expect.arrayContaining(['sort.bench.js > sorting > Array#sort', 'sort.bench.js > async'])
    );
    expect(bench('--compare', out).stdout).toMatch(/Array#sort +[\d.,]+ \([+-][\d.]+%\)/);
  });
});

describe('statistics', () => {
  it('measures as tinybench does', () => {
    const stats = statistics([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 55);
    expect(stats).toMatchObject({ mean: 5.5, min: 1, max: 10, p75: 8, p99: 10, samples: 10, hz: 1000 / 5.5 });
    expect(stats.rme).toBeCloseTo(((2.262 * (Math.sqrt(9.1666666) / Math.sqrt(10))) / 5.5) * 100, 3);
  });

  it('measures sync and async functions, with setup and teardown', async () => {
    const calls = [];
    const sync = await measure(() => calls.push('s'), {
      time: 5,
      iterations: 5,
      warmupTime: 1,
      setup: () => calls.push('setup'),
      teardown: () => calls.push('teardown'),
    });
    expect(calls[0]).toBe('setup');
    expect(calls.at(-1)).toBe('teardown');
    expect(sync.samples).toBeGreaterThanOrEqual(5);
    const async = await measure(
      () =>
        new Promise((resolve) => {
          setImmediate(resolve);
        }),
      {
        time: 5,
        iterations: 5,
        warmupTime: 1,
      }
    );
    expect(async.mean).toBeGreaterThan(0);
  });
});
