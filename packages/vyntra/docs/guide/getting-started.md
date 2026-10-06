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
