# Configuration

In `vyntra.config.js`, `"vyntra"` in `package.json`, or your Vitest or Jest configuration, from which vyntra takes the options it knows (see [the guide](../guide/configuration.md) and [Migrating](../migrating/introduction.md)).

| Option | Default | What it does |
| --- | --- | --- |
| `include` | `*.{test,spec}.*`, `__tests__` | Globs of the test files |
| `exclude` | `node_modules`, `.git`, `dist`, `coverage` | Globs of the folders and files left out |
| `excludePatterns` | `[]` | Regular expressions of paths left out (Jest's `testPathIgnorePatterns`) |
| `roots` | `['.']` | Folders to look for tests in |
| `engine` | `undefined` | The kind of tests of the project: `'web'` runs them in a browser with `@vyntra/web` (see [End-to-end tests](../guide/e2e.md)) |
| `includeSource` | `[]` | Globs of source files that hold tests of their own, in an `if (import.meta.vitest)` block (see [In-source tests](../guide/running.md)) |
| `projects` | `undefined` | Parts of the suite with options of their own: `{ name, include, dependsOn, globalSetup, globalTeardown, ... }`; `root` is the folder its paths are from, and `inherit: false` leaves out the top level's options (see [Projects](../guide/projects.md)). A Vitest or Jest config's projects are read as these |
| `globalSetup`, `globalTeardown` | `undefined` | Files run once in the main process, before and after the test files (see [Global setup](../guide/projects.md)) |
| `server` | `undefined` | A command started before the tests and stopped after: `{ command, url \| port, timeout, reuseExisting, env, cwd }` (see [A server for the tests](../guide/projects.md)) |
| `use` | `undefined` | Options of the fixtures (`{ baseURL: 'http://localhost:4000' }`): each a fixture tests can destructure, and the value of a `test.extend` option of that name |
| `setupFiles` | `[]` | Files loaded before every test file: paths from the root, or package names (`'reflect-metadata'`, `'jest-extended/all'`) |
| `testTimeout` | `5000` | Timeout of tests, in ms |
| `hookTimeout` | `testTimeout` | Timeout of hooks |
| `hookOrder` | `'stack'` (`'list'` from a Jest config) | The order of a suite's `afterEach` and `afterAll` hooks: `'stack'`, the last registered first, as Vitest; `'list'`, as declared, as Jest |
| `unawaitedAssertions` | `'wait'` (`'settled'` from a Jest config) | Assertions a test does not await (`expect(promise).resolves...`): `'wait'` for them within the test's timeout, as Vitest; `'settled'` counts only those that fail straight away, as Jest drops them |
| `retry` | `0` | Retries of failing tests |
| `maxConcurrency` | `5` | Concurrent tests running at once |
| `pool` | `'threads'` | `'threads'`, `'forks'` or `'inline'` |
| `maxWorkers` | from the last run | Number of workers, or `'50%'` |
| `isolate` | `true` | Fresh project modules for every file |
| `isolateDependencies` | `[]` | Packages loaded fresh for every file too, for those that keep state of their own (MSW's interceptors) |
| `replaceFailedWorkers` | `true` | Replaces a worker whose file failed, so what the failure left broken does not reach the next files |
| `workerMemoryLimit` | `1024` | Megabytes of heap after which a worker is replaced (`0`: never) |
| `failOnFlaky` | `false` | Fails the run when a test passed only on a retry |
| `outputDir` | `'.vyntra'` | Where every run writes `report.json`, which `--last-failed` reads; `false` writes nothing |
| `splitFiles` | `false` | `true` or globs: files whose tests do not depend on each other, which vyntra may run in parts on several workers when they are the long ones |
| `clearMocks`, `resetMocks`, `restoreMocks` | `false` | Clears, resets or restores every mock before each test |
| `allowOnly` | `true` | Fails files with `.only` when false |
| `passWithNoTests` | `false` | Succeeds with no test files |
| `bail` | `0` | Stops after that many failed files |
| `silent` | `false` | Hides console output; `'passed-only'` keeps that of failing tests, as Vitest |
| `env` | none | Environment variables set for the run, before the workers start (Vitest's `test.env`). vyntra does not set `NODE_ENV`: `{ NODE_ENV: 'test' }` gives what Jest and Vitest set. When the config changes the locale (`LC_ALL`, `LANG`, `LC_TIME`... in `env`, or in `process.env` from the config file), vyntra starts again with it, as Node.js only reads it when it starts; `TZ` needs no restart |
| `environment` | `'node'` | `'node'`, `'jsdom'` or `'happy-dom'` (your project's), or an environment of your own by path or package (see [Test environments](../guide/running.md)); a file can ask for its own with a `@vitest-environment` or `@jest-environment` comment |
| `environmentUrl` | none | The URL the document reports |
| `environmentOptions` | none | Options of the document, in Vitest's shape: `{ jsdom: { ... }, happyDOM: { settings } }` |
| `moduleNameMapper` | none | Jest's: `{ '^@app/(.*)$': '<rootDir>/src/$1' }` |
| `alias` | none | Vite's: `[{ find, replacement }]`, a string matching the specifier or its subpaths, a regular expression replaced as `String.replace` does |
| `moduleFileExtensions` | `js`, `mjs`, `cjs`, `ts`, `mts`, `cts`, `json`, `node` | Extensions tried for an import that names no file, as a bundler does |
| `transform` | on | `false` loads files as they are, without compiling JSX or TypeScript-only syntax. A Jest config's `transform` (your transformers) is read from the Jest config |
| `plugins` | `[]` | Vite plugins: their `transform`, `resolveId` and `load` hooks run on your files, async ones too |
| `compileCache` | `false` | Keeps V8's compiled code on disk, in `node_modules/.cache/vyntra` |
| `reporter` | `'default'` | A name or a list: `'default'`, `'verbose'` or `'json'` to print the run, and `'junit'`, `'markdown'`, `'github'` to write it (`'github'` is added under GitHub Actions when none is set) |
| `coverage` | `false` | Collects coverage (Jest's `collectCoverage`) |
| `collectCoverageFrom` | every loaded file | Globs of the files to report, `!` to leave out |
| `coverageDirectory` | `'coverage'` | Where `lcov.info` goes |
| `coverageReporters` | `['text', 'lcov']` | Reports to make |
| `coverageThreshold` | none | `{ global: { lines, functions, branches, statements } }`: minimum percentages, or maximum uncovered counts when negative |
