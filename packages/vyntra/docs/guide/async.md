# Async tests

A test that returns a promise ends when the promise settles. A test (or hook) that takes a parameter which is not the test context gets Jest's `done` callback, and ends when it is called:

```js
test('async/await', async () => {
  expect(await fetchUser(1)).toEqual({ id: 1 });
});

test('done callback', (done) => {
  emitter.once('ready', () => done());
  emitter.start();
});
```

A test fails when it takes longer than its timeout: 5 seconds, or `testTimeout` in the configuration, or the number given after the test function (`test(name, fn, 10000)`). An error thrown later by a timer, or a promise nobody handles, fails the test that was running.

A `.resolves` or `.rejects` assertion you forget to `await` still fails its test: vyntra waits for it before the test ends.

## Retries

`retry` runs a failing test again, up to that many times: `test(name, { retry: 2 }, fn)`, or `--retry 2` for all of them. `repeats` runs a passing test that many more times, to catch flaky ones.

A test that passes only on a retry is **flaky**, not passed: it is counted apart in the summary and listed with the errors of the attempts that failed, so a retry does not hide it. It does not fail the run, unless `--fail-on-flaky` (or `failOnFlaky: true`) is given.
