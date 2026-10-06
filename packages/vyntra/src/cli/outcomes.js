const fs = require('node:fs');
const path = require('node:path');
const { userFrames, samePath } = require('../utils/stack');

// eslint-disable-next-line no-control-regex
const stripAnsi = (text) => String(text).replace(/\u001b\[[0-9;]*m/g, '');

function realPath(file) {
  try {
    return fs.realpathSync.native(file);
  } catch {
    return file;
  }
}

// A file from a root, as a / path. Stack frames name files by their real path: through a symlinked root (macOS's
// /var is /private/var) both sides are resolved first.
function relative(rootDir, file) {
  const plain = path.relative(rootDir, file);
  const name = plain.startsWith('..') ? path.relative(realPath(rootDir), realPath(file)) : plain;
  return name.split(path.sep).join('/');
}

// The plain text of an error: its name and message, without colors.
const describeError = (error) => stripAnsi(`${error.name}: ${error.message}`);

const MAX_LINE = 300;

// An error on one line, for summaries and attributes: its first lines joined, so the expected and received values of
// an assertion show.
function oneLine(error) {
  const text = describeError(error)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join(' · ');
  return text.length > MAX_LINE ? `${text.slice(0, MAX_LINE - 1)}…` : text;
}

// The error with the frames of the user's code only, without vyntra's.
const userStack = (error) =>
  [
    describeError(error),
    ...userFrames(error.stack).map((frame) => `    at ${frame.file}:${frame.line}:${frame.column}`),
  ].join('\n');

// Where an error happened in the user's code, preferring the test file itself.
function locate(error, file) {
  const frames = userFrames(error?.stack);
  return frames.find((frame) => samePath(frame.file, file)) ?? frames[0] ?? null;
}

// Results in the order of their files, the same in every run whatever order they finished in.
const byPath = (results) => [...results].sort((a, b) => (a.path < b.path ? -1 : Number(a.path > b.path)));

// What the file reporters tell about a run: every failed and flaky test, and every error outside the tests (a file
// that did not load, a failing afterAll), as { file, test, title, status, errors, attempts }.
function outcomesOf(results, rootDir) {
  return byPath(results).flatMap((result) => {
    const file = relative(rootDir, result.path);
    const where = result.project ? `[${result.project}] ${file}` : file;
    return [
      ...result.errors.map((error) => ({
        path: result.path,
        file,
        test: null,
        title: where,
        status: 'failed',
        errors: [error],
        attempts: [],
      })),
      ...result.tests
        .filter((test) => test.status === 'failed' || test.status === 'flaky')
        .map((test) => ({
          path: result.path,
          file,
          test,
          title: `${where} > ${test.path.join(' > ')}`,
          status: test.status,
          errors: test.errors,
          attempts: test.attempts ?? [],
        })),
    ];
  });
}

// Counts of a run's tests and files, as the summaries show them.
function countsOf(results) {
  const tests = results.flatMap((result) => result.tests);
  const count = (status) => tests.filter((test) => test.status === status).length;
  return {
    files: results.length,
    failedFiles: results.filter(
      (result) => result.errors.length > 0 || result.tests.some((test) => test.status === 'failed')
    ).length,
    tests: tests.length,
    passed: count('passed'),
    failed: count('failed'),
    flaky: count('flaky'),
    skipped: count('skipped') + count('todo'),
  };
}

module.exports = {
  byPath,
  stripAnsi,
  relative,
  describeError,
  oneLine,
  userStack,
  locate,
  outcomesOf,
  countsOf,
};
