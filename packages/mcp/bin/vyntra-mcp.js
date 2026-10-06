#!/usr/bin/env node
// Checked before anything loads: on an older Node.js the first missing API would fail with an error that does not
// say why.
const [major] = process.versions.node.split('.').map(Number);
if (major < 22) {
  process.stderr.write(`vyntra-mcp needs Node.js 22 or later; this is ${process.version}.\n`);
  process.exit(2);
}

const { startServer } = require('../src');

// vyntra-mcp [--root <dir>] [--max-sessions <n>]: the MCP server, on stdio, for the project in the current directory
// (or --root), with at most n live sessions open at once (4 by default).
const option = (name) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
};
const maxSessions = Number(option('--max-sessions') ?? 4);
startServer({
  rootDir: option('--root') ?? process.cwd(),
  maxSessions: Number.isInteger(maxSessions) && maxSessions > 0 ? maxSessions : 4,
});
