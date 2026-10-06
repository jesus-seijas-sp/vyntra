# Hooks

| Hook | Runs |
| --- | --- |
| `beforeAll(fn, timeout?)` | Once, before the tests of its suite. When it fails, those tests fail |
| `afterAll(fn, timeout?)` | Once, after the tests of its suite |
| `beforeEach(fn, timeout?)` | Before every test of its suite, outer suites first. A function it returns runs after the test |
| `afterEach(fn, timeout?)` | After every test of its suite, inner suites first |
| `onTestFinished(fn)` | Called in a test: after it, whatever its result |
| `onTestFailed(fn)` | Called in a test: after it, when it failed |
