const fs = require('node:fs');
const path = require('node:path');
const { testKey } = require('../run/test-key');

const VERSION = 1;

const toPosix = (rootDir, file) => path.relative(rootDir, file).split(path.sep).join('/');

const reportFile = (config) => path.resolve(config.rootDir, config.outputDir, 'report.json');

function readReport(config) {
  if (!config.outputDir) {
    return null;
  }
  try {
    const report = JSON.parse(fs.readFileSync(reportFile(config), 'utf8'));
    return report.version === VERSION && Array.isArray(report.owed) ? report : null;
  } catch {
    return null;
  }
}

// What a run still owes: { file, test } for a failed test, { file, test: null } for a file that did not load or
// failed outside its tests. A failure stays owed until its test runs again and passes, so a run that left it out
// (-t, a path filter, --shard, --bail) does not forget it; one whose test or file no longer exists is dropped, and
// so is one skipped in the code (.skip), which would otherwise be owed forever.
function owedAfter(previous, results, rootDir) {
  const ran = new Map(results.map((result) => [toPosix(rootDir, result.path), result]));
  const owed = new Map();
  const owe = (file, test) => owed.set(`${file}\0${test ? testKey(test) : ''}`, { file, test });
  previous.forEach(({ file, test }) => {
    const result = ran.get(file);
    if (!result) {
      if (fs.existsSync(path.resolve(rootDir, file))) {
        owe(file, test);
      }
      return;
    }
    if (result.tests.length === 0 && result.errors.length > 0) {
      owe(file, test);
    } else if (!test) {
      // The file loads now: what it owes are the tests that did not get to run.
      result.tests.filter((record) => record.filtered).forEach((record) => owe(file, record.path));
    } else if (result.tests.find((record) => testKey(record.path) === testKey(test))?.filtered) {
      owe(file, test);
    }
  });
  ran.forEach((result, file) => {
    if (result.errors.length > 0) {
      owe(file, null);
    }
    result.tests.filter((test) => test.status === 'failed').forEach((test) => owe(file, test.path));
  });
  return [...owed.values()];
}

// --last-failed: the files to run, and of each, the tests (null: all of them).
function rerunOf(report, rootDir) {
  const rerun = {};
  report.owed.forEach(({ file, test }) => {
    const absolute = path.resolve(rootDir, file);
    if (!test || rerun[absolute] === null) {
      rerun[absolute] = null;
    } else {
      (rerun[absolute] ??= []).push(testKey(test));
    }
  });
  return rerun;
}

function writeReport(config, { startedAt, duration, exitCode, results, owed, engines }) {
  if (!config.outputDir) {
    return;
  }
  const file = reportFile(config);
  const files = results.map(({ path: absolute, shards, work, ...result }) => ({
    ...result,
    path: toPosix(config.rootDir, absolute),
  }));
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(
    file,
    `${JSON.stringify({ version: VERSION, startedAt, duration, exitCode, owed, files, ...(engines ? { engines } : {}) })}\n`
  );
}

module.exports = { readReport, owedAfter, rerunOf, writeReport };
