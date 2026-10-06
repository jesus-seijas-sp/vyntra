const fs = require('node:fs');
const path = require('node:path');

// What `vyntra bench` prints and saves: a table per group of benchmarks (a describe of a file), the fastest of each
// group against the others, and the results as JSON (--outputJson) to compare a later run with (--compare).

const DEFAULT_INCLUDE = ['**/*.{bench,benchmark}.?(c|m)[jt]s?(x)'];

const rel = (rootDir, file) => path.relative(rootDir, file).split(path.sep).join('/');

// { 'file > group > name': stats } of a run's results.
function benchmarksOf(results, rootDir) {
  return Object.fromEntries(
    results.flatMap((result) =>
      result.tests
        .filter((test) => test.bench)
        .map((test) => [
          `${rel(rootDir, result.path)} > ${test.path.join(' > ')}`,
          { ...test.bench, status: test.status },
        ])
    )
  );
}

function writeJson(file, results, rootDir) {
  const target = path.resolve(rootDir, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify({ version: 1, benchmarks: benchmarksOf(results, rootDir) }, null, 2)}\n`);
}

function readJson(file, rootDir) {
  try {
    return JSON.parse(fs.readFileSync(path.resolve(rootDir, file), 'utf8')).benchmarks ?? {};
  } catch {
    return null;
  }
}

const number = (value, digits = 2) =>
  Number.isFinite(value)
    ? value.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })
    : String(value);

// The rows of a file's benchmarks, by group: [{ group, rows: [[cells]] }].
function tables(result, { rootDir, previous }) {
  const groups = new Map();
  result.tests
    .filter((test) => test.bench || test.status === 'skipped' || test.status === 'todo')
    .forEach((test) => {
      const group = test.path.slice(0, -1).join(' > ');
      if (!groups.has(group)) {
        groups.set(group, []);
      }
      const stats = test.bench;
      if (!stats) {
        groups.get(group).push([test.path.at(-1), test.status, '', '', '', '', '', '', '', '', '']);
        return;
      }
      const before = previous?.[`${rel(rootDir, result.path)} > ${test.path.join(' > ')}`];
      const change = before?.hz
        ? ` (${stats.hz >= before.hz ? '+' : ''}${number(((stats.hz - before.hz) / before.hz) * 100, 1)}%)`
        : '';
      groups
        .get(group)
        .push([
          test.path.at(-1),
          `${number(stats.hz)}${change}`,
          number(stats.min, 4),
          number(stats.max, 4),
          number(stats.mean, 4),
          number(stats.p75, 4),
          number(stats.p99, 4),
          number(stats.p995, 4),
          number(stats.p999, 4),
          `±${number(stats.rme)}%`,
          String(stats.samples),
        ]);
    });
  return [...groups].map(([group, rows]) => ({ group, rows }));
}

const HEADER = ['name', 'hz', 'min', 'max', 'mean', 'p75', 'p99', 'p995', 'p999', 'rme', 'samples'];

function formatTable(rows) {
  const all = [HEADER, ...rows];
  const widths = HEADER.map((_, i) => Math.max(...all.map((row) => (row[i] ?? '').length)));
  return all
    .map((row) => row.map((cell, i) => (i === 0 ? cell.padEnd(widths[i]) : cell.padStart(widths[i]))).join('  '))
    .map((line) => `   ${line}`)
    .join('\n');
}

// Per group of two or more: the fastest, and how many times faster it is than each of the others.
function summary(results, rootDir) {
  const lines = [];
  results.forEach((result) => {
    const groups = new Map();
    result.tests
      .filter((test) => test.bench)
      .forEach((test) => {
        const group = test.path.slice(0, -1).join(' > ');
        groups.set(group, [...(groups.get(group) ?? []), test]);
      });
    groups.forEach((tests, group) => {
      if (tests.length < 2) {
        return;
      }
      const [fastest, ...others] = [...tests].sort((a, b) => b.bench.hz - a.bench.hz);
      const where = [rel(rootDir, result.path), group].filter(Boolean).join(' > ');
      lines.push(`  ${fastest.path.at(-1)} - ${where}`);
      others.forEach((other) => {
        lines.push(`    ${number(fastest.bench.hz / other.bench.hz)}x faster than ${other.path.at(-1)}`);
      });
    });
  });
  return lines;
}

module.exports = { DEFAULT_INCLUDE, tables, formatTable, summary, writeJson, readJson };
