#!/usr/bin/env node
// The benchmark gate: does a change make vyntra slower? Runs the synthetic suite (bench/suite.js) with the base
// vyntra and with this one, alternately on the same machine, and fails when this one is slower by more than the
// threshold and the difference is not noise (one-sided Mann-Whitney and paired Wilcoxon tests). Shared CI machines
// vary by a few percent from run to run: the tests, not one pair of runs, decide. Measured on such a machine, a 5-7%
// slowdown fails and identical code passes; a 2-3% one is within the noise, and is reported, not failed.
//
//   node bench/gate.js --base <git ref | path to bin/vyntra.js> [--candidate <bin>] [--rounds 20] [--workers 2]
//                      [--threshold 0.02] [--alpha 0.01]

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync, execFileSync } = require('node:child_process');
const { parseArgs } = require('node:util');
const { writeSuite } = require('./suite');

const PACKAGE = path.join(__dirname, '..');

function options() {
  const { values } = parseArgs({
    options: {
      base: { type: 'string' },
      candidate: { type: 'string', default: path.join(PACKAGE, 'bin', 'vyntra.js') },
      rounds: { type: 'string', default: '20' },
      workers: { type: 'string', default: '2' },
      threshold: { type: 'string', default: '0.02' },
      alpha: { type: 'string', default: '0.01' },
    },
  });
  if (!values.base) {
    throw new Error('--base is the vyntra to compare with: a git ref (origin/main) or a path to bin/vyntra.js');
  }
  return {
    ...values,
    rounds: Number(values.rounds),
    workers: Number(values.workers),
    threshold: Number(values.threshold),
    alpha: Number(values.alpha),
  };
}

// The base vyntra's bin: a path as it is, or a git ref checked out aside (cleaned up by the returned function).
function baseBin(base) {
  if (base.endsWith('.js') && fs.existsSync(base)) {
    return { bin: path.resolve(base), cleanup: () => {} };
  }
  const repo = execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: PACKAGE, encoding: 'utf8' }).trim();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vyntra-gate-base-'));
  execFileSync('git', ['worktree', 'add', '--detach', dir, base], { cwd: repo, stdio: 'ignore' });
  const bin = [path.join(dir, 'packages', 'vyntra', 'bin', 'vyntra.js'), path.join(dir, 'bin', 'vyntra.js')].find(
    (file) => fs.existsSync(file)
  );
  const cleanup = () => execFileSync('git', ['worktree', 'remove', '--force', dir], { cwd: repo, stdio: 'ignore' });
  if (!bin) {
    cleanup();
    throw new Error(`No bin/vyntra.js at ${base}`);
  }
  return { bin, cleanup };
}

function run(bin, suite, workers) {
  const start = process.hrtime.bigint();
  const { status, stderr } = spawnSync(process.execPath, [bin, '--root', suite, '-w', String(workers), '--no-color'], {
    encoding: 'utf8',
    env: { ...process.env, CI: '', GITHUB_ACTIONS: '' },
  });
  if (status !== 0) {
    throw new Error(`${bin} failed the benchmark suite (exit ${status})\n${stderr}`);
  }
  return Number(process.hrtime.bigint() - start) / 1e6;
}

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

// Abramowitz and Stegun 7.1.26: enough for a p-value.
function normalCdf(z) {
  const t = 1 / (1 + (0.3275911 * Math.abs(z)) / Math.SQRT2);
  const poly = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
  const erf = 1 - poly * Math.exp(-(z * z) / 2);
  return z >= 0 ? (1 + erf) / 2 : (1 - erf) / 2;
}

// One-sided Mann-Whitney U: the probability of candidate times this much above the base ones by chance.
function mannWhitney(base, candidate) {
  const all = [
    ...base.map((value) => ({ value, from: 'base' })),
    ...candidate.map((value) => ({ value, from: 'candidate' })),
  ]
    .sort((a, b) => a.value - b.value)
    .map((item, i) => ({ ...item, rank: i + 1 }));
  // Tied values share the mean of their ranks.
  all.forEach((item) => {
    const tied = all.filter((other) => other.value === item.value);
    Object.assign(item, { tiedRank: tied.reduce((sum, other) => sum + other.rank, 0) / tied.length });
  });
  const n1 = base.length;
  const n2 = candidate.length;
  const ranks = all.filter((item) => item.from === 'candidate').reduce((sum, item) => sum + item.tiedRank, 0);
  const u = ranks - (n2 * (n2 + 1)) / 2;
  const mean = (n1 * n2) / 2;
  const sd = Math.sqrt((n1 * n2 * (n1 + n2 + 1)) / 12);
  return 1 - normalCdf((u - mean) / sd);
}

// One-sided Wilcoxon signed-rank test on the rounds' paired ratios: each round runs both back to back, so what drifts
// over the run (the machine's load, its clock) cancels out within a pair. The probability of ratios this far above
// 1 by chance.
function wilcoxon(base, candidate) {
  const differences = base
    .map((value, i) => Math.log(candidate[i] / value))
    .filter((value) => value !== 0)
    .map((value) => ({ value, size: Math.abs(value) }))
    .sort((a, b) => a.size - b.size)
    .map((item, i) => ({ ...item, rank: i + 1 }));
  differences.forEach((item) => {
    const tied = differences.filter((other) => other.size === item.size);
    Object.assign(item, { tiedRank: tied.reduce((sum, other) => sum + other.rank, 0) / tied.length });
  });
  const n = differences.length;
  if (n === 0) {
    return 1;
  }
  const positive = differences.filter((item) => item.value > 0).reduce((sum, item) => sum + item.tiedRank, 0);
  const mean = (n * (n + 1)) / 4;
  const sd = Math.sqrt((n * (n + 1) * (2 * n + 1)) / 24);
  return 1 - normalCdf((positive - mean) / sd);
}

function main() {
  const opts = options();
  const suite = fs.mkdtempSync(path.join(os.tmpdir(), 'vyntra-gate-suite-'));
  const { files, tests } = writeSuite(suite);
  const base = baseBin(opts.base);
  const times = { base: [], candidate: [] };
  try {
    // Warm the disk and Node's own caches for both.
    [base.bin, opts.candidate, base.bin, opts.candidate].forEach((bin) => run(bin, suite, opts.workers));
    for (let round = 0; round < opts.rounds; round += 1) {
      // ABBA: neither always goes first, so a machine getting faster or slower over the run hits both alike.
      const order = round % 2 ? ['candidate', 'base'] : ['base', 'candidate'];
      order.forEach((which) =>
        times[which].push(run(which === 'base' ? base.bin : opts.candidate, suite, opts.workers))
      );
    }
  } finally {
    base.cleanup();
    fs.rmSync(suite, { recursive: true, force: true });
  }
  const baseMedian = median(times.base);
  const candidateMedian = median(times.candidate);
  const ratio = candidateMedian / baseMedian;
  const p = Math.min(mannWhitney(times.base, times.candidate), wilcoxon(times.base, times.candidate));
  const pairedRatio = Math.exp(median(times.base.map((value, i) => Math.log(times.candidate[i] / value))));
  const slower = ratio > 1 + opts.threshold && p < opts.alpha;
  // Slower by the median, but within what this machine's noise could do: said, not failed.
  const unsure = !slower && ratio > 1 + opts.threshold;
  const report = [
    `## vyntra benchmark gate: ${slower ? 'slower' : 'passed'}${unsure ? ' (slower by the median, but not beyond the noise: run it again)' : ''}`,
    '',
    `${files} files, ${tests} tests, ${opts.workers} workers, ${opts.rounds} rounds each, ${os.cpus().length} cores.`,
    '',
    '| | Median | Min | Max |',
    '| --- | ---: | ---: | ---: |',
    ...['base', 'candidate'].map(
      (which) =>
        `| ${which} | ${median(times[which]).toFixed(0)} ms | ${Math.min(...times[which]).toFixed(0)} ms | ${Math.max(...times[which]).toFixed(0)} ms |`
    ),
    '',
    `Candidate / base: **${ratio.toFixed(3)}** (${((ratio - 1) * 100).toFixed(1)}%; ${pairedRatio.toFixed(3)} round by round), p = ${p.toFixed(4)} that it is this much slower by chance. ` +
      `It fails when slower by more than ${(opts.threshold * 100).toFixed(0)}% with p < ${opts.alpha}.`,
    '',
  ].join('\n');
  process.stdout.write(report);
  if (process.env.GITHUB_STEP_SUMMARY) {
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, report);
  }
  process.exitCode = slower ? 1 : 0;
}

if (require.main === module) {
  main();
}

module.exports = { mannWhitney, wilcoxon, median };
