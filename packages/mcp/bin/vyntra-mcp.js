#!/usr/bin/env node
// Checked before anything loads: on an older Node.js the first missing API would fail with an error that does not
// say why.
const [major] = process.versions.node.split('.').map(Number);
if (major < 22) {
  process.stderr.write(`vyntra-mcp needs Node.js 22 or later; this is ${process.version}.\n`);
  process.exit(2);
}

const { startServer } = require('../src');

// vyntra-mcp [--root <dir>]: the MCP server, on stdio, for the project in the current directory (or --root).
const index = process.argv.indexOf('--root');
startServer({ rootDir: index >= 0 ? process.argv[index + 1] : process.cwd() });
