# Getting started

Install it as a development dependency. It needs Node.js 22 or later, and nothing else.

```bash
npm install --save-dev vyntra
```

Write a test in any file whose name ends in `.test.js` or `.spec.js` (or `.ts`, `.mjs`, `.cjs`...):

```js
// sum.test.js
const { sum } = require('./sum');

describe('sum', () => {
  it('adds two numbers', () => {
    expect(sum(1, 2)).toBe(3);
  });
});
```

And run it:

```bash
npx vyntra
```

```text
 VYNTRA running 1 test files on inline

 ✓ sum.test.js (1 tests) 2ms

 Test Files  1 passed (1)
      Tests  1 passed (1)
   Duration  31ms
```

`describe`, `it`, `test`, `expect`, the hooks, `vi` and `jest` are globals. If you prefer imports, take them from `vyntra`, or leave the ones from `vitest` or `@jest/globals` you already have: they resolve to vyntra.

```js
import { describe, expect, it, vi } from 'vyntra';
```

Finally, point your `test` script at it:

```json
{
  "scripts": {
    "test": "vyntra"
  }
}
```

## Setting a project up

`npx vyntra init` sets a project up for every kind of test at once. It asks which kinds besides unit tests (API, end-to-end, AI steps), how the app starts and where it answers, and which model the AI steps use; then it writes `vyntra.config.js` with a project per kind, an example test of each, the skill for coding agents, the vyntra MCP server in `.mcp.json`, `.vyntra/` in `.gitignore` and a test script, and prints what to install. With `--yes` it asks nothing and takes `--kinds`, `--command`, `--url`, `--provider` and `--model`; it replaces nothing without `--force`.
