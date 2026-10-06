# Running tests

With no arguments, vyntra runs every test file of the project. Arguments filter the files by their path, as in Jest; `-t` filters the tests by their full name (the names of their `describe` blocks and their own).

```bash
npx vyntra                      # every test file
npx vyntra src/users            # the files whose path matches src/users
npx vyntra -t "saves the user"  # the tests whose name matches
npx vyntra --coverage           # with a coverage report
npx vyntra -u                   # update the snapshots that changed
```

A test file is any `*.test.*` or `*.spec.*` file, or any file in a `__tests__` folder, out of `node_modules`, `dist` and `coverage`.

## What it prints

A line per file as it finishes, then every failure with its diff, the line of your test where it happened, and a summary. The output of `console.log` in a test is shown with the test that wrote it; `--silent` hides it.

```text
 FAIL users.test.js > users > saves the profile
AssertionError: expect(received).toEqual(expected)

- Expected  - 1
+ Received  + 1

  {
    "name": "Ann",
-   "role": "admin",
+   "role": "user",
  }

> 12 |     expect(saved).toEqual({ name: 'Ann', role: 'admin' });
     |                   ^

 ❯ users.test.js:12:19
```

`--verbose` lists every test; `--reporter json` prints the whole run as one JSON document, for tools. Other reporters write the run next to it: see [Reports for CI and agents](ci.md).

## Test environments of your own

`environment` (Vitest) or `testEnvironment` (Jest) can name an environment of your own, by path or package (`jest-environment-<name>`, `vitest-environment-<name>`), and so can a file's `@vitest-environment` or `@jest-environment` comment. It is set up before each of its files and torn down after:

- A Vitest environment, `{ name, setup(global, options) }`, gets the global object the tests run in, and its options from `environmentOptions[name]`.
- A Jest environment class gets `testEnvironmentOptions` and the test file's path as Jest gives them. Jest runs the tests in its `this.global`; vyntra runs them in the worker's global, over the node or jsdom environment the class extends, and copies in what the class adds to its global.

## In-source tests

As in Vitest, tests can live in the source file they test, in an `if (import.meta.vitest)` block, for the files `includeSource` names. A file there that has such a block is a test file; `import.meta.vitest` is the test API in it, and `undefined` anywhere else, so a module another test file imports does not add its tests to that one. A build leaves the block out with Vite's `define: { 'import.meta.vitest': 'undefined' }`.

```js
// src/math.js, with includeSource: ['src/**/*.js']
export const add = (a, b) => a + b;

if (import.meta.vitest) {
  const { it, expect } = import.meta.vitest;
  it('adds', () => {
    expect(add(1, 2)).toBe(3);
  });
}
```

## Type tests

`vyntra --typecheck` (or Vitest's `typecheck.enabled`) checks the types of the `*.test-d.ts` files instead of running them, with your project's `tsc`, as Vitest does: a type error fails the test whose call it is in, one outside every test fails the file, and one in a file the tests reach fails the run unless `typecheck.ignoreSourceErrors`. The other tests run as usual; `--typecheck.only` runs none of them. `expectTypeOf` and `assertType` are there for the checker, and do nothing at run time. `typecheck.include`, `tsconfig` and `checker` (`'vue-tsc'`) are read as Vitest reads them.

## Watch mode

`vyntra --watch` (or `vyntra watch`, or Jest's `--watchAll`) runs the tests, then runs again what each change touches, until you quit: a changed test file runs again, a changed module reruns the test files that loaded it, a new test file runs, and a change to the config (or `package.json`, or a `.env` file) reruns everything. In a terminal, keys narrow it: Enter runs the last ones again, a all, f the files that failed, p and t filter by file and by test name, q quits.

It knows what a test file loaded by watching it load, so a module only its types reach (compiled away) does not rerun anything, and with `isolate: false` a module loaded by an earlier file is only known for that one.

## Common flags

| Flag | What it does |
| --- | --- |
| `-t, --testNamePattern` | Run only the tests whose full name matches this regular expression |
| `-u, --update` | Write the snapshots that changed |
| `--coverage` | Collect coverage and print a report |
| `--coverageDirectory <dir>` | Write the coverage reports to another directory |
| `--silent` | Do not print what the tests write to the console |
| `-w, --maxWorkers` | Number of workers, or a percentage of the cores (`50%`) |
| `-i, --runInBand` | Run every file in the main thread |
| `--pool forks` | Run the files in child processes, as Jest does |
| `--bail <n>` | Stop after `n` files failed |

Every flag is in the [API reference](../api/cli.md).
