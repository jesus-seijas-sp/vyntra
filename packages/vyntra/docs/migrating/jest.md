# From Jest

Your tests, your `jest.config.js` (or the `"jest"` key of `package.json`) and your flags keep working:

```json
{
  "scripts": {
    "test": "vyntra --silent --coverage"
  }
}
```

- The globals: `describe`, `it`, `test`, `expect`, the hooks, `jest`, and the old `fail()`.
- Imports from `@jest/globals`.
- `jest.fn`, `jest.spyOn`, `jest.mock` with its hoisting, `__mocks__` folders, automock, `jest.requireActual`, `jest.isolateModules`, fake timers.
- Every matcher, asymmetric matchers, `expect.extend`, the `done` callback.
- Your `.snap` files, read and written in Jest's format.
- The flags `-t`, `-u`, `-i`, `--ci`, `--silent`, `--verbose`, `--coverage`, `--maxWorkers`, `--bail`, `--passWithNoTests`, and path patterns.

## Jest options vyntra reads

| Jest option | In vyntra |
| --- | --- |
| `testTimeout`, `maxWorkers`, `bail`, `maxConcurrency` | ✓ The same |
| `testMatch`, `roots`, `testPathIgnorePatterns`, `modulePathIgnorePatterns` | ✓ Which files are tests |
| `preset` | ✓ A path or a package's `jest-preset`, merged as Jest merges it |
| `setupFiles`, `setupFilesAfterEnv` | ✓ Loaded before every test file |
| `clearMocks`, `resetMocks`, `restoreMocks` | ✓ The same |
| `collectCoverage`, `collectCoverageFrom`, `coverageDirectory`, `coverageReporters`, `coverageThreshold` | ✓ V8 coverage, text and lcov reports |
| `testEnvironment: 'node'`, `'jsdom'`, `'happy-dom'` | ✓ With the jsdom or happy-dom your project has; a file can ask for its own with a `@jest-environment` comment |
| `moduleNameMapper` | ✓ The same |
| `transform`, `transformIgnorePatterns` | ✓ Your transformers (`babel-jest`, `ts-jest`, `@swc/jest`, your own) compile the files they match, with `process()`, or `processAsync()` on a helper thread |
| `testEnvironment` as a module of your own (a class extending `NodeEnvironment` or `JSDOMEnvironment`), `testEnvironmentOptions` | ✓ Set up and torn down for each file. The tests run in the worker's global, not in a VM context: what the class adds to `this.global` is copied there, over the node or jsdom environment it extends. See [Test environments](../guide/running.md) |
| Babel without a `transform` (Jest runs `babel-jest` by itself when it finds a Babel config) | ✓ The same: with a Babel config and `babel-jest` installed, `.js`, `.jsx`, `.ts` and `.tsx` files go through it; `transform: {}` turns it off |
| `globalSetup`, `globalTeardown` | ✓ Run once, in the main process, before and after the test files |
| `projects`, `displayName` | ✓ Each project from its own `rootDir`: folders with a `jest.config.*` or a `"jest"` key, config files, or projects written inline. As in Jest, they do not take the root config's options. See [Projects](../guide/projects.md) |
| `snapshotSerializers` | ✗ Call `expect.addSnapshotSerializer` in a setup file |

## Differences with Jest

- **Worker threads, not processes.** Jest runs tests in child processes. vyntra uses threads, which start faster; `process.send` exists in them (and sends nothing), as code under test sometimes calls it. For code that needs a whole process (`process.chdir`, native addons that are not thread safe), use `--pool forks`. On Windows, a worker thread that loaded some native addons together (SQLite's and swc's, in Strapi) can crash the whole run when it ends: `--pool forks` avoids it.
- **Dependencies are shared by the files of a worker.** Every test file gets fresh copies of your own modules, as in Jest, but the modules of `node_modules` are loaded once per worker. After a file that mocks modules, the dependencies it loaded once it had mocks are loaded again for the next file (all of them when it mocked a builtin such as `fs`). A test that changes the state of a dependency loaded before (a global setting of a library) should undo it.
- **`NODE_ENV` is left as it is.** Jest sets it to `test` when it is not set; vyntra does not. Code that behaves differently under `test` needs `NODE_ENV=test` in the environment, or `env: { NODE_ENV: 'test' }` in `vyntra.config.js`.
- **`import()` works.** Jest can not run the `import()` of an ES module from CommonJS without `--experimental-vm-modules`; vyntra runs it, as Node.js does. A test that expects it to fail sees it succeed.
- **Mock factories are not checked.** Jest refuses factories that use variables whose names do not start with `mock`; vyntra does not check them, and hoists the calls the same way.
