# Test context

The first parameter of a test function, when it is destructured or named `context`, `ctx` or `task`. Any other parameter is Jest's `done` callback.

| Property | What it is |
| --- | --- |
| `task` | `{ name, fullName, mode, file, suite, meta }` |
| `expect` | An `expect` for this test, for concurrent tests |
| `skip(note?)`, `skip(condition, note?)` | Stops the test and marks it as skipped |
| `signal` | An `AbortSignal` aborted when the test ends |
| `onTestFinished(fn)`, `onTestFailed(fn)` | As the globals |
| fixtures | The values of the fixtures of `test.extend` the test destructures, the values of the config's `use`, the built-in `api` and `server` (`{ url, name, reused }`), and an engine's (`page`, `context`, `browser`) |
| `testInfo` | For fixtures that keep evidence: `failed` (set before fixtures tear down), `attempt`, `outputPath(...parts)` (the attempt's folder in `.vyntra/artifacts`), `attach(name, { path \| body, contentType })` (shown on the failure page) |
