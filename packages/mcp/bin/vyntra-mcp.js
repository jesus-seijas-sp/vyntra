#!/usr/bin/env node
const { startServer } = require('../src');

// vyntra-mcp [--root <dir>]: the MCP server, on stdio, for the project in the current directory (or --root).
const index = process.argv.indexOf('--root');
startServer({ rootDir: index >= 0 ? process.argv[index + 1] : process.cwd() });
