#!/usr/bin/env node
const { main } = require('../src/cli');
const { EXIT } = require('../src/cli/exit-codes');

// Output piped to a command that stops reading (vyntra | head) is not an error.
process.stdout.on('error', (error) => {
  if (error.code !== 'EPIPE') {
    throw error;
  }
});

// Exits once the output is flushed, even if tests left handles open (servers, intervals).
const exit = (code) => process.stdout.write('', () => process.exit(code));

// An error that reaches here is vyntra's own: test and config errors are reported, not thrown.
main().then(exit, (error) => {
  process.stderr.write(`${error.stack ?? error}\n`);
  exit(EXIT.internal);
});
