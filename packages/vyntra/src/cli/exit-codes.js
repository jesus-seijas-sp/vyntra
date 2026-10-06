// What a run's exit code tells CI and agents: a broken test (1) from a broken setup (2, 3) or a broken vyntra (4).
const EXIT = {
  passed: 0,
  failed: 1,
  // A config that does not load, no test files, a file that does not load, an .only with allowOnly: false.
  setup: 2,
  // Something outside the project that the tests need: a server, a browser, a model provider.
  environment: 3,
  internal: 4,
  interrupted: 130,
};

// File errors that come before any test runs: the file's tests never got the chance to pass or fail (a globalSetup
// that threw is one too).
const SETUP_PHASES = new Set(['collect', 'policy', 'setup']);

const brokeSetup = (result) => result.errors.some((error) => SETUP_PHASES.has(error.phase));

module.exports = { EXIT, brokeSetup };
