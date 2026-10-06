// What engines (@vyntra/web, @vyntra/ai) use from the core, as `require('vyntra/engine')`: the test running now, the
// project's options, the replay cache, and the errors that end a test in a way of their own.
const path = require('node:path');
const state = require('./state');
const { ReplayCache } = require('./replay-cache');
const { SkipError } = require('./run/skip-error');
const { registerSecret, redact } = require('./secrets');

// A problem outside the project that a test met (a model provider that failed, a budget used up): the run ends with
// exit code 3, not 1.
class EnvironmentError extends Error {
  constructor(message, options) {
    super(message, options);
    this.name = 'EnvironmentError';
    this.phase = 'environment';
  }
}

// The test running in this thread now: { file, titlePath, fullName, attempt, signal, verifications, attach(name, { body }) },
// or null outside a test.
function currentTest() {
  const { test, file } = state;
  if (!test || !file) {
    return null;
  }
  return {
    file: file.path,
    titlePath: test.titlePath,
    fullName: test.fullName,
    attempt: test.attempt,
    signal: test.abort?.signal,
    get verifications() {
      return test.verifications ?? 0;
    },
    get tainted() {
      return test.tainted ?? false;
    },
    attach: (name, { path: attached, body, contentType = 'text/plain' } = {}) => {
      test.attachments.push({ name, path: attached, body: body === undefined ? undefined : String(body), contentType });
    },
  };
}

// A check of the app passed in the running test (a web-first assertion, agent.assert): what an engine recorded before
// it is confirmed.
function verified() {
  if (state.test) {
    state.test.verifications = (state.test.verifications ?? 0) + 1;
  }
}

// A secret was typed into the page in the running test: its screenshots and traces are not kept.
function taint() {
  if (state.test) {
    state.test.tainted = true;
  }
}

// The options of the project running in this thread.
function projectConfig() {
  const { config } = state;
  return {
    name: config.name,
    rootDir: config.rootDir ?? process.cwd(),
    outputDir: path.resolve(config.rootDir ?? process.cwd(), config.outputDir || '.vyntra'),
    use: config.use ?? {},
  };
}

module.exports = {
  currentTest,
  verified,
  taint,
  registerSecret,
  redact,
  projectConfig,
  ReplayCache,
  SkipError,
  EnvironmentError,
};
