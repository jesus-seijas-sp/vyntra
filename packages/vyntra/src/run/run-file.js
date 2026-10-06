/* eslint-disable no-await-in-loop -- setup files and async describe blocks are collected in order */
const state = require('../state');
const { Suite } = require('../collect/suite');
const { loadModule } = require('../loader');
const { packagesReached } = require('../modules/mock-order');
const { hasDependencyListeners, reattachListeners } = require('../listeners');
const { resolveKey } = require('../modules/registry');
const { releaseMocks } = require('../mock');
const { timers, realTimers } = require('../timers');
const { FileRunner } = require('./file-runner');
const { teardownScope } = require('./fixtures');
const { serializeError } = require('./serialize-error');
const { testKey } = require('./test-key');

const now = realTimers.performanceNow;

function createFileState(path) {
  return {
    path,
    root: new Suite(),
    hasOnly: false,
    assertionCalls: 0,
    errors: [],
    // Uncaught errors and unhandled rejections, given to the running test when it ends.
    uncaught: [],
    // describe() callbacks that returned a promise.
    pendingCollections: [],
    // Tests registered so far: the index of the next one.
    testCount: 0,
    console: [],
    snapshot: null,
  };
}

// Loads the setup files and the test file, which registers its suites and tests.
async function collect(file, config) {
  state.suite = file.root;
  const hooks = state.dependencyHooks ?? [];
  if (hooks.length > 0 || hasDependencyListeners()) {
    const imported = packagesReached([...(config.setupFiles ?? []), file.path], resolveKey);
    hooks
      .filter(({ dependency }) => imported.has(dependency))
      .forEach(({ kind, fn, timeout }) => file.root.hooks[kind].push({ fn, timeout }));
    reattachListeners(imported);
  }
  try {
    const setupFiles = config.setupFiles ?? [];
    for (let i = 0; i < setupFiles.length; i += 1) {
      await loadModule(setupFiles[i], config, true);
    }
    await loadModule(file.path, config, false);
    for (let i = 0; i < file.pendingCollections.length; i += 1) {
      const { suite, promise } = file.pendingCollections[i];
      state.suite = suite;
      try {
        await promise;
      } catch (error) {
        suite.collectError = error;
      }
    }
  } catch (error) {
    file.errors.push({ ...serializeError(error), phase: 'collect' });
  } finally {
    state.suite = null;
  }
}

// complete: every test of the file ran, so the snapshots none of them checked are obsolete. Never for a shard.
function saveSnapshots(file, results, shard) {
  const complete = !shard && results.every((test) => ['passed', 'flaky', 'failed'].includes(test.status));
  try {
    return file.snapshot?.save(complete) ?? null;
  } catch (error) {
    file.errors.push(serializeError(error));
    return null;
  }
}

// The tests this run wants of the file: those -t matches, and under --last-failed those the last run left failing.
function selection(path, config) {
  const pattern = config.testNamePattern ? new RegExp(config.testNamePattern, 'i') : null;
  const owed = config.rerun?.[path] ? new Set(config.rerun[path]) : null;
  if (!pattern && !owed) {
    return null;
  }
  return (test) => (!pattern || pattern.test(test.fullName)) && (!owed || owed.has(testKey(test.titlePath)));
}

// A shard of a split file ({ index, count }) runs one test of every count, the ones whose index is shard.index
// modulo count: the tests of a file usually go from quick to slow, so interleaving them shares the time out evenly.
async function runFile(path, config, shard = null) {
  const start = now();
  const file = createFileState(path);
  state.file = file;
  state.test = null;
  await collect(file, config);
  const collectDuration = now() - start;
  if (file.hasOnly && config.allowOnly === false) {
    file.errors.push({
      ...serializeError(new Error('Unexpected .only modifier. Remove it or pass --allowOnly to bypass this error')),
      phase: 'policy',
    });
  }
  const runner = new FileRunner(file, config);
  if (file.errors.length === 0) {
    file.root.interpretModes(file.hasOnly, selection(path, config));
    if (shard) {
      file.root.retainTests((test) => test.index % shard.count === shard.index);
    }
    await runner.runSuite(file.root);
  }
  file.errors.push(...(await teardownScope('file')).map(serializeError));
  file.errors.push(...file.uncaught.splice(0).map(serializeError));
  const snapshot = saveSnapshots(file, runner.results, shard);
  timers.useRealTimers();
  releaseMocks();
  state.file = null;
  return {
    path,
    duration: now() - start,
    collectDuration,
    tests: runner.results,
    errors: file.errors,
    console: file.console,
    snapshot,
    shard,
  };
}

// An error nobody caught: it fails the running test, or the file when no test is running.
function reportUncaught(error) {
  const { file } = state;
  if (!file) {
    return false;
  }
  if (state.test) {
    file.uncaught.push(error);
  } else {
    file.errors.push(serializeError(error));
  }
  return true;
}

module.exports = { runFile, reportUncaught };
