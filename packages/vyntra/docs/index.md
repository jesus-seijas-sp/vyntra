# vyntra documentation

Read a topic with `vyntra guide <topic>`, or open its file here. Generated from the website; do not edit.

## Guide

- [Guide](guide/introduction.md) `guide/introduction`: vyntra is a test runner for Node.js with the API of Jest and Vitest.
- [Getting started](guide/getting-started.md) `guide/getting-started`: Install it as a development dependency.
- [Running tests](guide/running.md) `guide/running`: With no arguments, vyntra runs every test file of the project.
- [Configuration](guide/configuration.md) `guide/configuration`: Most projects need none.
- [Tests and suites](guide/tests.md) `guide/tests`: `test` (or `it`) declares a test; `describe` groups tests, and its name is part of theirs.
- [Hooks](guide/hooks.md) `guide/hooks`: `beforeAll` and `afterAll` run once around the tests of their `describe` (or of the file, at the top level); `beforeEach` and `afterEach` a…
- [Async tests](guide/async.md) `guide/async`: A test that returns a promise ends when the promise settles.
- [Test context and fixtures](guide/context.md) `guide/context`: Every test gets a context object, as in Vitest: its `task` (name, file), an `expect` of its own, `skip()`, `signal` (aborted when the test …
- [Assertions](guide/assertions.md) `guide/assertions`: `expect(value)` has every matcher of Jest and the ones Vitest adds.
- [Mock functions](guide/mocks.md) `guide/mocks`: `vi.fn()` (the same as `jest.fn()`) makes a function that records its calls.
- [Module mocks](guide/module-mocks.md) `guide/module-mocks`: `vi.mock(path, factory)` (or `jest.mock`) replaces a module with what the factory returns, for the test file and everything it loads.
- [Fake timers](guide/timers.md) `guide/timers`: `vi.useFakeTimers()` replaces `setTimeout`, `setInterval`, `setImmediate`, `Date` and `performance.now` by a clock that only moves when the…
- [Snapshots](guide/snapshots.md) `guide/snapshots`: `toMatchSnapshot()` saves a value the first time, in `__snapshots__/<file>.snap`, and compares it with the saved one after.
- [Coverage](guide/coverage.md) `guide/coverage`: `vyntra --coverage` reports which lines, functions and branches of your code the tests ran.
- [Workers and isolation](guide/isolation.md) `guide/isolation`: vyntra runs the files in parallel, in worker threads that stay alive between files.
- [CI and reports](guide/ci.md) `guide/ci`: What a run leaves for CI and for coding agents: reports in files, the failures to rerun, slices of the suite for parallel jobs, and exit co…
- [Projects](guide/projects.md) `guide/projects`: A project is a part of the suite with options of its own: its files, environment, setup files, timeouts, workers.
- [API tests](guide/api-tests.md) `guide/api-tests`: The `api` fixture is an HTTP client for the test.
- [End-to-end tests](guide/e2e.md) `guide/e2e`: A project with `engine: 'web'` runs its tests in a browser, with `@vyntra/web` on Playwright.
- [TypeScript and ES modules](guide/typescript.md) `guide/typescript`: vyntra loads files with Node.js, so what Node.js runs, vyntra runs: CommonJS, ES modules (`.mjs`, or `"type": "module"`), and TypeScript (`…
- [What files can import](guide/imports.md) `guide/imports`: Code written for a bundler (Vite, webpack) imports things Node.js refuses.
- [Why it is fast](guide/speed.md) `guide/speed`: Measured on real suites, most of a test run is not the tests.
- [FAQ](guide/faq.md) `guide/faq`: Do I have to change my tests? My tests call process.send. What is not supported yet?

## API reference

- [API reference](api/introduction.md) `api/introduction`: Everything vyntra provides.
- [test and it](api/test.md) `api/test`: `test(name, fn, timeout?)` declares a test; `it` is the same function.
- [describe](api/describe.md) `api/describe`: `describe(name, fn, options?)` groups tests (`suite` is the same function).
- [Hooks](api/hooks.md) `api/hooks`: 
- [Test context](api/context.md) `api/context`: The first parameter of a test function, when it is destructured or named `context`, `ctx` or `task`.
- [Matchers](api/matchers.md) `api/matchers`: `expect(value, message?)` returns the matchers.
- [HTTP matchers](api/http-matchers.md) `api/http-matchers`: 
- [The api fixture](api/api-fixture.md) `api/api-fixture`: 
- [Mock matchers](api/mock-matchers.md) `api/mock-matchers`: Jest's older names work too: `toBeCalled`, `toBeCalledTimes`, `toBeCalledWith`, `lastCalledWith`, `nthCalledWith`, `toReturn`, `toReturnTim…
- [Snapshot matchers](api/snapshot-matchers.md) `api/snapshot-matchers`: Line endings of the values are written as `\n`, so a snapshot taken on Windows matches on Linux and the other way around.
- [Asymmetric matchers](api/asymmetric.md) `api/asymmetric`: Used in expected values: they match any value that passes their check.
- [expect helpers](api/expect-helpers.md) `api/expect-helpers`: 
- [Mocks and spies](api/vi-mocks.md) `api/vi-mocks`: 
- [Mock function methods](api/mock-methods.md) `api/mock-methods`: 
- [Module mocks](api/vi-modules.md) `api/vi-modules`: 
- [Fake timers](api/vi-timers.md) `api/vi-timers`: 
- [Stubs and waiting](api/vi-other.md) `api/vi-other`: 
- [Command line](api/cli.md) `api/cli`: Path patterns are regular expressions matched against the path of every test file.
- [Configuration](api/config.md) `api/config`: In `vyntra.config.js`, `"vyntra"` in `package.json`, or your Vitest or Jest configuration, from which vyntra takes the options it knows (se…

## Migrating from Jest and Vitest

- [Migrating from Jest and Vitest](migrating/introduction.md) `migrating/introduction`: vyntra runs Jest and Vitest suites as they are.
- [Try it first](migrating/try.md) `migrating/try`: Nothing has to change to try it, not even your dependencies: `npx` downloads vyntra to its cache and runs it in your project, next to your …
- [From Jest](migrating/jest.md) `migrating/jest`: Your tests, your `jest.config.js` (or the `"jest"` key of `package.json`) and your flags keep working:
- [From Vitest](migrating/vitest.md) `migrating/vitest`: Your test files run as they are, imports from `vitest` included:
- [Not supported yet](migrating/missing.md) `migrating/missing`: If your suite needs one of them, keep your current runner for now, or run the tests that need it with it.
