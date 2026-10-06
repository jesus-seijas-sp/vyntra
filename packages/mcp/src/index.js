const path = require('node:path');
const { serve } = require('./protocol');
const { createTools } = require('./tools');
const { version } = require('../package.json');

const INSTRUCTIONS =
  'Tools for the tests of this project, run with vyntra. run_tests runs them (all, some files, a test name, a ' +
  'project, or only what failed last time) and lists what failed; read_failure gives the page of a failure, with ' +
  'what is needed to fix it; guide gives the documentation; try_locator tries a Playwright locator on a page for ' +
  'end-to-end tests. Fix what a failure page shows, then run_tests with lastFailed until nothing fails.';

function startServer({ rootDir = process.cwd(), input = process.stdin, output = process.stdout } = {}) {
  const { tools, close } = createTools({ rootDir: path.resolve(rootDir) });
  serve({ info: { name: 'vyntra', version }, instructions: INSTRUCTIONS, tools }, input, output);
  input.on('end', () => {
    close().finally(() => process.exit(0));
  });
}

module.exports = { startServer };
