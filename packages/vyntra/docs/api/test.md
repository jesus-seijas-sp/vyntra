# test and it

`test(name, fn, timeout?)` declares a test; `it` is the same function. `fn` may return a promise, or take Jest's `done` callback. The options can be an object: `test(name, { timeout, retry, repeats }, fn)`.

| Form | What it does |
| --- | --- |
| `test.skip` | Declares the test without running it |
| `test.only` | Runs only the `.only` tests and suites of the file |
| `test.todo(name)` | A test still to write |
| `test.fails` / `test.failing` | Passes when the test fails, and fails when it passes |
| `test.concurrent` | Runs at the same time as the other concurrent tests of its suite |
| `test.sequential` | Runs alone, in a concurrent suite |
| `test.skipIf(condition)` | Skips the test when `condition` is truthy |
| `test.runIf(condition)` | Runs the test only when `condition` is truthy |
| `test.each(table)(name, fn)` | A test per case: arrays are spread as arguments, objects given as they are, tagged templates as objects |
| `test.for(table)(name, fn)` | A test per case, the case given as it is and the context second |
| `test.extend(fixtures)` | A `test` with fixtures (see [the guide](../guide/context.md)). `[fn, { scope: 'file' \| 'worker' }]` shares one, `[value, { option: true }]` takes its value from the config's `use`, `[fn, { auto: true }]` sets it up for every test |

Modifiers chain: `test.skip.each`, `test.only.concurrent`... Titles of `.each` take `%s %d %i %f %j %o %O %p`, `%#` (index), `%$` (index + 1), `%%`, and `$key.path` for object cases.
