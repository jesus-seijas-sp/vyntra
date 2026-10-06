# Configuration

Most projects need none. When there is, vyntra takes it from the first of these that exists:

1. `vyntra.config.js` (or `.cjs`, `.mjs`), or the file given with `--config`
2. a `"vyntra"` key in `package.json`
3. your Vitest configuration: `vitest.config.ts` (or `.mts`, `.js`, `.mjs`...), or a `vite.config.*` with a `test` section
4. your Jest configuration: `jest.config.js` (or `.cjs`, `.mjs`, `.json`), or a `"jest"` key in `package.json`

```js
// vyntra.config.js
module.exports = {
  include: ['**/*.{test,spec}.?(c|m)[jt]s?(x)'],
  exclude: ['**/node_modules/**', '**/dist/**'],
  setupFiles: ['./test/setup.js'],
  testTimeout: 10000,
  restoreMocks: true,
  coverageThreshold: { global: { lines: 90 } },
};
```

From a Jest configuration vyntra takes `testTimeout`, `testMatch`, `testPathIgnorePatterns`, `roots`, `setupFiles`, `setupFilesAfterEnv`, `clearMocks`, `resetMocks`, `restoreMocks`, `maxWorkers`, `bail` and the coverage options. Every option is in the [API reference](../api/config.md).
