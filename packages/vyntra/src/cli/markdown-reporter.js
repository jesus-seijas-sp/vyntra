const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { codeFrame, userFrames } = require('../utils/stack');
const { stripAnsi, relative, describeError, oneLine, locate, outcomesOf, countsOf } = require('./outcomes');

const MAX_FRAMES = 6;

// A fence longer than any run of backticks in the text, so no output can close it early.
function fenced(text, language = 'text') {
  const longest = Math.max(2, ...(String(text).match(/`+/g) ?? []).map((run) => run.length));
  const fence = '`'.repeat(longest + 1);
  return `${fence}${language}\n${text}\n${fence}`;
}

const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// failures/<slug>.md: readable, unique (the hash), and the same for the same test in every run.
function pageName({ file, test }) {
  const key = test ? `${file} > ${test.path.join(' > ')}` : file;
  const readable = key
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
  const hash = crypto.createHash('sha1').update(key).digest('hex').slice(0, 8);
  return `${readable}-${hash}.md`;
}

function counts(results, duration) {
  const totals = countsOf(results);
  const tests = [
    totals.failed && `${totals.failed} failed`,
    totals.flaky && `${totals.flaky} flaky`,
    totals.passed && `${totals.passed} passed`,
    totals.skipped && `${totals.skipped} skipped`,
  ].filter(Boolean);
  return [
    `- **Files:** ${totals.failedFiles} failed, ${totals.files - totals.failedFiles} passed (${totals.files})`,
    `- **Tests:** ${tests.join(', ') || 'none'} (${totals.tests})`,
    `- **Duration:** ${(duration / 1000).toFixed(2)}s`,
  ];
}

// The run in Markdown, with a line per failed or flaky test; link(outcome) gives each its page, if there are pages.
function summaryOf(results, rootDir, duration, link = () => null) {
  const outcomes = outcomesOf(results, rootDir);
  const success = !outcomes.some((outcome) => outcome.status === 'failed');
  const line = (outcome) => {
    const page = link(outcome);
    const title = page ? `[\`${outcome.title}\`](${page})` : `\`${outcome.title}\``;
    const [error] = outcome.status === 'flaky' ? (outcome.attempts[0]?.errors ?? []) : outcome.errors;
    return `- ${title}${error ? `: ${oneLine(error)}` : ''}`;
  };
  const section = (heading, list) =>
    list.length > 0 ? ['', `## ${heading} (${list.length})`, '', ...list.map(line)] : [];
  return [
    `# vyntra: ${success ? 'passed' : 'failed'}`,
    '',
    ...counts(results, duration),
    ...section(
      'Failed',
      outcomes.filter((outcome) => outcome.status === 'failed')
    ),
    ...section(
      'Flaky',
      outcomes.filter((outcome) => outcome.status === 'flaky')
    ),
    '',
  ].join('\n');
}

// The error, the line it happened on, and where it came from.
function errorSection(error, file, rootDir) {
  const frame = locate(error, file);
  const parts = [fenced(describeError(error))];
  if (frame) {
    const source = stripAnsi(codeFrame(frame, 3));
    if (source) {
      parts.push(fenced(source, path.extname(frame.file).slice(1) || 'text'));
    }
    const frames = userFrames(error.stack).slice(0, MAX_FRAMES);
    parts.push(frames.map((one) => `- \`${relative(rootDir, one.file)}:${one.line}:${one.column}\``).join('\n'));
  }
  if (error.cause) {
    parts.push('Caused by:', errorSection(error.cause, file, rootDir));
  }
  return parts.join('\n\n');
}

const headerLines = (headers) =>
  Object.entries(headers ?? {})
    .map(([name, value]) => `${name}: ${value}`)
    .join('\n');

// The requests a test made with the api fixture, and what came back, the last one first: usually the one that failed.
function exchangesSection(exchanges) {
  return [...exchanges].reverse().flatMap(({ request, response, error, duration }, i) => {
    const title = `### ${i === 0 ? 'Last request: ' : ''}${request.method} ${request.url}`;
    const sent = [`${request.method} ${request.url}`, headerLines(request.headers), request.body && `\n${request.body}`]
      .filter(Boolean)
      .join('\n');
    const answer = response
      ? [
          `${response.status}${duration !== undefined ? ` (${duration}ms)` : ''}`,
          headerLines(response.headers),
          response.body && `\n${response.body}`,
        ]
          .filter(Boolean)
          .join('\n')
      : `No response: ${error}`;
    return ['', title, '', 'Request:', '', fenced(sent, 'http'), '', 'Response:', '', fenced(answer, 'http')];
  });
}

// .vyntra/summary.md and a page per failed or flaky test in .vyntra/failures/: the error and its source line, every
// attempt, the test's console output and the command that reruns it. Written for people and for coding agents.
class MarkdownReporter {
  constructor(config) {
    this.config = config;
    this.results = [];
    this.dir = path.resolve(config.rootDir, config.outputDir || '.vyntra');
  }

  // eslint-disable-next-line class-methods-use-this
  onStart() {}

  onFileResult(result) {
    this.results.push(result);
  }

  page(outcome, result) {
    const { file, test } = outcome;
    const lines = [`# ${outcome.title}`, ''];
    const attempts = outcome.attempts.length + 1;
    const status =
      outcome.status === 'flaky'
        ? `flaky: passed on attempt ${attempts} of ${attempts}`
        : `failed${attempts > 1 ? ` on all ${attempts} attempts` : ''}`;
    lines.push(`- **Status:** ${test ? status : 'the file failed outside its tests'}`, `- **File:** \`${file}\``);
    const frame = locate(outcome.errors[0] ?? outcome.attempts[0]?.errors[0], outcome.path);
    if (frame) {
      lines.push(`- **Line:** \`${relative(this.config.rootDir, frame.file)}:${frame.line}\``);
    }
    if (outcome.status === 'failed') {
      lines.push(
        '',
        '## Error',
        '',
        ...outcome.errors.map((error) => errorSection(error, outcome.path, this.config.rootDir))
      );
    }
    if (test?.exchanges) {
      lines.push('', '## HTTP', ...exchangesSection(test.exchanges));
    }
    outcome.attempts.forEach(({ errors, exchanges }, i) => {
      lines.push(
        '',
        `## Attempt ${i + 1} (failed)`,
        '',
        ...errors.map((error) => errorSection(error, outcome.path, this.config.rootDir))
      );
      if (exchanges) {
        lines.push(...exchangesSection(exchanges));
      }
    });
    const output = result.console.filter((entry) => (test ? entry.test === test.name : !entry.test));
    if (output.length > 0) {
      const text = output.map(({ type, text: logged }) => `${type}: ${stripAnsi(logged)}`).join('\n');
      lines.push('', '## Console output', '', fenced(text));
    }
    if (result.serverOutput) {
      lines.push(
        '',
        '## Server output',
        '',
        'The last lines the server printed by the end of the file:',
        '',
        fenced(stripAnsi(result.serverOutput))
      );
    }
    const rerun = test
      ? `npx vyntra ${file} -t '${escapeRegExp(test.name).replaceAll("'", "'\\''")}'`
      : `npx vyntra ${file}`;
    lines.push('', '## Rerun', '', fenced(`${rerun}\nnpx vyntra --last-failed`, 'sh'), '');
    return lines.join('\n');
  }

  onFinish(duration) {
    const failures = path.join(this.dir, 'failures');
    fs.mkdirSync(failures, { recursive: true });
    const byPath = new Map(this.results.map((result) => [result.path, result]));
    const outcomes = outcomesOf(this.results, this.config.rootDir);
    outcomes.forEach((outcome) => {
      fs.writeFileSync(path.join(failures, pageName(outcome)), this.page(outcome, byPath.get(outcome.path)));
    });
    // Under --last-failed the pages of earlier runs stay: those of the tests that pass now go.
    this.results.forEach((result) => {
      const file = relative(this.config.rootDir, result.path);
      result.tests
        .filter((test) => test.status === 'passed')
        .forEach((test) => fs.rmSync(path.join(failures, pageName({ file, test })), { force: true }));
      if (result.errors.length === 0) {
        fs.rmSync(path.join(failures, pageName({ file, test: null })), { force: true });
      }
    });
    const summary = summaryOf(
      this.results,
      this.config.rootDir,
      duration,
      (outcome) => `failures/${pageName(outcome)}`
    );
    fs.writeFileSync(path.join(this.dir, 'summary.md'), summary);
    return true;
  }
}

module.exports = { MarkdownReporter, summaryOf };
