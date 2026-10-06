// vyntra in a browser page (browser mode, run by @vyntra/web): the test file and this runtime are bundled together;
// the bundle calls prepare() before the test file's code runs, so its describe/it calls register here, then
// finish(), which runs the tests with the same FileRunner as in Node and gives back the same result.

const state = require('../state');
const api = require('../index');
const { Suite } = require('../collect/suite');
const { FileRunner } = require('../run/file-runner');
const { serializeError } = require('../run/serialize-error');
const { realTimers } = require('../timers/real-timers');
const { domMatchers } = require('./dom-matchers');
const { expectElement } = require('./context');
const { createRegistry } = require('./mocks');

const now = () => realTimers.performanceNow();
const CONSOLE_METHODS = ['log', 'info', 'warn', 'error', 'debug', 'trace', 'dir'];

function format(args) {
  return args
    .map((arg) => {
      if (typeof arg === 'string') {
        return arg;
      }
      if (arg instanceof Error) {
        return arg.stack ?? String(arg);
      }
      if (typeof Node !== 'undefined' && arg instanceof Node) {
        return arg.outerHTML ?? arg.textContent ?? String(arg);
      }
      try {
        return JSON.stringify(arg);
      } catch {
        return String(arg);
      }
    })
    .join(' ');
}

function captureConsole() {
  CONSOLE_METHODS.forEach((type) => {
    // eslint-disable-next-line no-console -- tests' output goes with their results
    const original = console[type].bind(console);
    // eslint-disable-next-line no-console
    console[type] = (...args) => {
      const { file, test } = state;
      if (file) {
        file.console.push({ type, test: test?.fullName, text: format(args) });
      }
      original(...args);
    };
  });
}

let started;

// Before the test file's code: the file's state, the globals tests use without importing them.
function prepare({ path, config }) {
  started = now();
  // From here errors are the tests' (see @vyntra/web's runner): the page's own handlers no longer fail the file.
  globalThis[Symbol.for('vyntra.started')] = true;
  state.config = config;
  state.file = {
    path,
    root: new Suite(),
    hasOnly: false,
    assertionCalls: 0,
    errors: [],
    uncaught: [],
    pendingCollections: [],
    testCount: 0,
    console: [],
    snapshot: null,
  };
  state.suite = state.file.root;
  state.test = null;
  api.installGlobals(globalThis);
  // vi.mock and vi.doMock go to the page's registry: no module loader to hook here.
  const registry = createRegistry(api.vi);
  api.vi.mock = (specifier, factory) => registry.register(specifier, factory);
  api.vi.doMock = api.vi.mock;
  api.vi.unmock = () => {};
  api.vi.doUnmock = () => {};
  api.vi.importActual = async () => {
    throw new Error('vi.importActual is not available in browser mode: use the importOriginal argument of the factory');
  };
  // jest-dom's matchers, as vitest's browser mode has them, and expect.element, which retries them.
  api.expect.extend(domMatchers);
  api.expect.element = expectElement;
  captureConsole();
  const uncaught = (error) => {
    const { file } = state;
    if (state.test) {
      file.uncaught.push(error);
    } else {
      file.errors.push(serializeError(error));
    }
  };
  globalThis.addEventListener('error', (event) => uncaught(event.error ?? new Error(event.message)));
  globalThis.addEventListener('unhandledrejection', (event) => uncaught(event.reason));
}

// After the test file's code: its tests, run; the result, as a Node worker's.
async function finish({ config, error }) {
  const { file } = state;
  if (error) {
    file.errors.push({ ...serializeError(error), phase: 'collect' });
  }
  for (let i = 0; i < file.pendingCollections.length; i += 1) {
    const { suite, promise } = file.pendingCollections[i];
    try {
      // eslint-disable-next-line no-await-in-loop -- describe blocks collect in order
      await promise;
    } catch (collectError) {
      suite.collectError = collectError;
    }
  }
  const collectDuration = now() - started;
  const runner = new FileRunner(file, config);
  if (file.errors.length === 0) {
    const pattern = config.testNamePattern ? new RegExp(config.testNamePattern, 'i') : null;
    file.root.interpretModes(file.hasOnly, pattern ? (test) => pattern.test(test.fullName) : null);
    await runner.runSuite(file.root);
  }
  file.errors.push(...file.uncaught.splice(0).map(serializeError));
  state.suite = null;
  return {
    path: file.path,
    duration: now() - started,
    collectDuration,
    tests: runner.results,
    errors: file.errors,
    console: file.console,
    snapshot: null,
    // Saved by Node (see host.js).
    snapshotState: file.snapshot?.transfer() ?? null,
    shard: null,
  };
}

module.exports = { prepare, finish, api };
