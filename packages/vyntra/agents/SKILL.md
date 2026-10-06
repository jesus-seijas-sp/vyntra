---
name: vyntra
description: Run, write and fix tests in a project that uses vyntra (a Jest/Vitest compatible test runner with projects, API and end-to-end tests). Use when running tests, reading a test failure, writing a new test, or changing the test configuration.
---

# Testing with vyntra

This project's tests run with vyntra. It runs Jest and Vitest tests as they are (`describe`, `it`, `expect`,
`vi`/`jest` mocks, snapshots, fake timers), and adds projects, API tests and end-to-end tests in a browser.

## Run tests

```sh
npx vyntra                       # every test
npx vyntra src/users             # the files whose path matches
npx vyntra -t "saves the user"   # the tests whose name matches
npx vyntra --project api         # one project of the config
npx vyntra --last-failed         # only what failed in the last run, until it passes
```

The exit code says what happened: `0` passed, `1` a test failed, `2` the setup is broken (the config or a test
file does not load, no test files), `3` something the tests need did not start (a server), `4` vyntra itself
failed. Fix a `2` or a `3` before reading test failures: the tests may not have run.

## Read a failure

Run with the markdown reporter, then read the failure's page; it has what you need to fix it, without running the
test again:

```sh
npx vyntra --reporter default,markdown
```

- `.vyntra/summary.md` lists the failed and flaky tests, each linked to its page.
- `.vyntra/failures/<test>.md` has the error, the source line where it happened, every attempt, the test's console
  output and the command that reruns only that test. An API test's page shows its HTTP requests and responses and
  the server's last lines; an end-to-end test's page shows a screenshot, the page's URL and accessibility tree, its
  console and network, and a Playwright trace.
- `.vyntra/report.json` has every result, as data.

A test reported as **flaky** passed only on a retry: it is not fixed, the retry hid the failure. Its page shows the
failed attempts.

## Fix a failing test

1. Read the failure page. Decide whether the test or the code is wrong: the test describes the behaviour wanted,
   so change it only when that behaviour changed.
2. Fix it, then rerun only that test with the command at the end of its page.
3. Run `npx vyntra --last-failed` until nothing is left, then the whole suite once.

## Write a test

- Put it next to the code as `<name>.test.ts` (or as the project's config says: `npx vyntra guide configuration`).
- Use the project's style: look at the tests around it first.
- Fixtures: destructure what the test needs, `test('...', async ({ api, page }) => ...)`. `api` is an HTTP client
  (`npx vyntra guide api-tests`), `page` a browser page in an `engine: 'web'` project (`npx vyntra guide e2e`).
- End-to-end tests: find elements by role and name (`page.getByRole('button', { name: 'Save' })`), and assert
  with the retrying matchers (`await expect(locator).toHaveText('Saved')`): never wait for a fixed time.

## Look things up

The documentation ships with vyntra. `npx vyntra guide` lists the topics; `npx vyntra guide <topic>` prints one
(`projects`, `api-tests`, `e2e`, `ci`, `mocks`, `module-mocks`, `timers`, `snapshots`, `api/config`,
`api/cli`, `api/matchers`...). The files are in `node_modules/vyntra/docs`.
