const path = require('node:path');
const { colors: c } = require('../colors');
const { userFrames, codeFrame } = require('../utils/stack');
const { tables, formatTable, summary } = require('../bench/report');

const ICONS = {
  passed: c.green('✓'),
  flaky: c.yellow('✓'),
  failed: c.red('×'),
  skipped: c.yellow('↓'),
  todo: c.gray('□'),
};
const MAX_STACK_FRAMES = 6;
const MAX_FLAKY_LINES = 6;

function formatDuration(ms) {
  if (ms < 1000) {
    return `${Math.round(ms)}ms`;
  }
  return `${(ms / 1000).toFixed(2)}s`;
}

function countLine(label, counts, total) {
  const parts = [
    counts.failed && c.bold(c.red(`${counts.failed} failed`)),
    counts.flaky && c.bold(c.yellow(`${counts.flaky} flaky`)),
    counts.passed && c.bold(c.green(`${counts.passed} passed`)),
    counts.skipped && c.yellow(`${counts.skipped} skipped`),
    counts.todo && c.gray(`${counts.todo} todo`),
  ].filter(Boolean);
  return `${c.dim(label.padStart(11))}  ${parts.join(c.dim(' | ')) || c.dim('no tests')} ${c.gray(`(${total})`)}`;
}

// Prints a line per file as results arrive, the details of every failure at the end and a summary.
class Reporter {
  constructor(config, out = process.stdout) {
    this.config = config;
    this.out = out;
    this.results = [];
    this.verbose = config.reporter === 'verbose';
  }

  write(text = '') {
    this.out.write(`${text}\n`);
  }

  // A file as the lines show it: from the root, after its project's name in a run of several.
  label(result) {
    const file = this.relative(result.path);
    return result.project ? `${c.dim(`[${result.project}]`)} ${file}` : file;
  }

  relative(file) {
    return path.relative(this.config.rootDir, file).split(path.sep).join('/');
  }

  onStart(fileCount, workers) {
    const mode = this.config.pool === 'inline' ? 'inline' : `${workers} worker${workers === 1 ? '' : 's'}`;
    const { shard, rerunning, projectNames } = this.config;
    const notes = [
      shard && `shard ${shard.index}/${shard.total}`,
      rerunning && `last failed: ${rerunning}`,
      projectNames && `projects: ${projectNames.join(', ')}`,
    ].filter(Boolean);
    const scope = notes.length > 0 ? ` (${notes.join(', ')})` : '';
    this.write(`\n ${c.bold(c.cyan('VYNTRA'))} ${c.dim(`running ${fileCount} test files${scope} on ${mode}`)}\n`);
  }

  // silent: 'passed-only' (as in vitest) keeps the output of failing tests only, and of a failing file outside them.
  printConsole(result, broken) {
    const failed = new Set(result.tests.filter((entry) => entry.status === 'failed').map((entry) => entry.name));
    const shown =
      this.config.silent === 'passed-only'
        ? result.console.filter(({ test }) => (test ? failed.has(test) : broken))
        : result.console;
    shown.forEach(({ type, test, text }) => {
      const where = [this.label(result), test].filter(Boolean).join(' > ');
      const stream = type === 'error' || type === 'warn' ? 'stderr' : 'stdout';
      this.write(c.dim(`${stream} | ${where}`));
      this.write(`${text}\n`);
    });
  }

  onFileResult(result) {
    this.results.push(result);
    const failed = result.tests.filter((test) => test.status === 'failed');
    const flaky = result.tests.filter((test) => test.status === 'flaky');
    const broken = failed.length > 0 || result.errors.length > 0;
    this.printConsole(result, broken);
    const counts = [
      failed.length > 0 ? ` | ${c.red(`${failed.length} failed`)}` : '',
      flaky.length > 0 ? ` | ${c.yellow(`${flaky.length} flaky`)}` : '',
    ].join('');
    const icon = broken ? c.red('❯') : c.green('✓');
    this.write(
      ` ${icon} ${this.label(result)} ${c.dim(`(${result.tests.length} tests${counts})`)} ${c.gray(formatDuration(result.duration))}`
    );
    const shown = this.verbose ? result.tests : [...failed, ...flaky];
    shown.forEach((test) => {
      this.write(`   ${ICONS[test.status]} ${test.path.join(' > ')} ${c.gray(formatDuration(test.duration))}`);
    });
    if (this.config.mode === 'bench') {
      tables(result, { rootDir: this.config.rootDir, previous: this.config.benchPrevious }).forEach(
        ({ group, rows }) => {
          if (group) {
            this.write(c.dim(`   ${group}`));
          }
          this.write(formatTable(rows));
        }
      );
    }
  }

  printError(error, indent = '') {
    this.write(`${indent}${c.red(c.bold(`${error.name}: `))}${error.message.split('\n').join(`\n${indent}`)}`);
    const frames = userFrames(error.stack);
    if (frames.length > 0) {
      this.write('');
      this.write(codeFrame(frames[0]));
      this.write('');
      frames.slice(0, MAX_STACK_FRAMES).forEach((frame) => {
        this.write(c.gray(` ❯ ${this.relative(frame.file)}:${frame.line}:${frame.column}`));
      });
    }
    if (error.cause) {
      this.write(`\n${indent}${c.dim('Caused by:')}`);
      this.printError(error.cause, `${indent}  `);
    }
    this.write('');
  }

  printFailures() {
    const failures = this.results.flatMap((result) => [
      ...result.errors.map((error) => ({ title: `${this.label(result)}`, error, kind: 'Suite error' })),
      ...result.tests
        .filter((test) => test.status === 'failed')
        .flatMap((test) =>
          test.errors.map((error) => ({ title: `${this.label(result)} > ${test.path.join(' > ')}`, error }))
        ),
    ]);
    if (failures.length === 0) {
      return;
    }
    this.write(`\n${c.red(c.bold(`⎯⎯⎯⎯⎯⎯ Failed Tests ${failures.length} ⎯⎯⎯⎯⎯⎯`))}\n`);
    failures.forEach(({ title, error, kind }) => {
      this.write(`${c.bgRed(c.bold(' FAIL '))} ${kind ? `${c.red(kind)} ` : ''}${title}`);
      this.printError(error);
    });
  }

  // A test that passed on a retry: where, on which attempt, and why the attempts before it failed.
  printFlaky() {
    const flaky = this.results.flatMap((result) =>
      result.tests.filter((test) => test.status === 'flaky').map((test) => ({ result, test }))
    );
    if (flaky.length === 0) {
      return;
    }
    this.write(`\n${c.yellow(c.bold(`⎯⎯⎯⎯⎯⎯ Flaky Tests ${flaky.length} ⎯⎯⎯⎯⎯⎯`))}\n`);
    flaky.forEach(({ result, test }) => {
      const title = `${this.label(result)} > ${test.path.join(' > ')}`;
      this.write(`${c.bgYellow(c.bold(' FLAKY '))} ${title} ${c.dim(`(passed on attempt ${test.retries + 1})`)}`);
      (test.attempts ?? []).forEach(({ errors }, i) => {
        const [error] = errors;
        const lines = error ? `${error.name}: ${error.message}`.split('\n').filter((line) => line.trim()) : ['failed'];
        this.write(c.dim(`   attempt ${i + 1}: ${lines.slice(0, MAX_FLAKY_LINES).join('\n     ')}`));
      });
    });
  }

  printSnapshots() {
    const totals = { added: 0, updated: 0, failed: 0, obsolete: 0 };
    this.results.forEach(({ snapshot }) => {
      Object.keys(totals).forEach((key) => {
        totals[key] += snapshot?.[key] ?? 0;
      });
    });
    const parts = [
      totals.failed && c.bold(c.red(`${totals.failed} failed`)),
      totals.added && c.bold(c.green(`${totals.added} written`)),
      totals.updated && c.bold(c.green(`${totals.updated} updated`)),
      totals.obsolete && c.yellow(`${totals.obsolete} obsolete (run with -u to remove)`),
    ].filter(Boolean);
    if (parts.length > 0) {
      this.write(`${c.dim('Snapshots'.padStart(11))}  ${parts.join(c.dim(' | '))}`);
    }
  }

  // Prints the summary and returns whether the run succeeded. engineLines: [label, text] pairs the engines add (the
  // AI engine's tokens and cache), above the duration.
  onFinish(duration, engineLines = []) {
    this.printFailures();
    this.printFlaky();
    if (this.config.mode === 'bench') {
      const lines = summary(this.results, this.config.rootDir);
      if (lines.length > 0) {
        this.write(`\n ${c.bold(c.cyan('BENCH'))} ${c.dim('Summary')}\n`);
        lines.forEach((line) => this.write(line));
      }
    }
    const tests = this.results.flatMap((result) => result.tests);
    const count = (list, status) => list.filter((item) => item.status === status).length;
    const testCounts = Object.fromEntries(
      ['passed', 'flaky', 'failed', 'skipped', 'todo'].map((s) => [s, count(tests, s)])
    );
    const fileStatus = this.results.map((result) => {
      const failed = result.errors.length > 0 || result.tests.some((test) => test.status === 'failed');
      if (failed) {
        return 'failed';
      }
      const ran = result.tests.some((test) => test.status === 'passed' || test.status === 'flaky');
      return result.tests.length > 0 && !ran ? 'skipped' : 'passed';
    });
    const fileCounts = Object.fromEntries(
      ['passed', 'failed', 'skipped'].map((s) => [s, fileStatus.filter((status) => status === s).length])
    );
    this.write('');
    this.write(countLine('Test Files', fileCounts, this.results.length));
    this.write(countLine('Tests', testCounts, tests.length));
    this.printSnapshots();
    engineLines.forEach(([label, text]) => this.write(`${c.dim(label.padStart(11))}  ${text}`));
    this.write(`${c.dim('Duration'.padStart(11))}  ${formatDuration(duration)}`);
    this.write('');
    return fileCounts.failed === 0 && !(this.config.failOnFlaky && testCounts.flaky > 0);
  }
}

module.exports = { Reporter };
