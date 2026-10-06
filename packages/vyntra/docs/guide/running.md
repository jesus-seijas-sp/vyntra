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
