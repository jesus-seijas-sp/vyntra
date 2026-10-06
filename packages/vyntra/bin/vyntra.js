#!/usr/bin/env node
// Checked before anything loads: on an older Node.js the first missing API would fail with an error that does not
// say why.
const [major] = process.versions.node.split('.').map(Number);
if (major < 22) {
  process.stderr.write(`vyntra needs Node.js 22 or later; this is ${process.version}.\n`);
  process.exit(2);
}

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
