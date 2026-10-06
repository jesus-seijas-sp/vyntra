# Coverage

`vyntra --coverage` reports which lines, functions and branches of your code the tests ran. V8 counts them as the code runs; nothing is instrumented, so the tests run nearly as fast as without coverage.

```bash
npx vyntra --coverage
```

```text
----------------|---------|----------|---------|---------|-------------------
File            | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
----------------|---------|----------|---------|---------|-------------------
All files       |   94.49 |    92.41 |   94.65 |   94.49 |
src/cart.js     |  100.00 |   100.00 |  100.00 |  100.00 |
src/prices.js   |   56.52 |    83.72 |  100.00 |   56.52 | 15-25,28-34
----------------|---------|----------|---------|---------|-------------------
```

It also writes `coverage/lcov.info`, for editors and services. The report counts the project files the tests load, not the tests themselves nor `node_modules`. The options:

```js
module.exports = {
  collectCoverageFrom: ['src/**', '!src/generated/**'],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov'],
  coverageThreshold: { global: { lines: 90, functions: 90 } },
};
```

Lines are counted as Jest counts them: blank lines, comments and lines with only brackets are not lines of code. Branches are the blocks V8 counts, which can differ a little from what istanbul reports.

With `collectCoverageFrom` (or Vitest's `coverage.include`), the report also lists the files it matches that no test loaded, at zero, as Jest and Vitest do: an untested file lowers the totals instead of going unnoticed. Test files and `.d.ts` files are left out. Without it, the report shows the files the tests loaded.
