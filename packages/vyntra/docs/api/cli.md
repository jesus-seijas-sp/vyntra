# Command line

```bash
vyntra [options] [path patterns...]
```

Path patterns are regular expressions matched against the path of every test file. The names of Jest and Vitest flags are accepted.

| Flag | What it does |
| --- | --- |
| `-t, --testNamePattern <regex>` | Runs only the tests whose full name matches (also `--grep`) |
| `--grep-invert <regex>` | Leaves out the tests whose full name matches |
| `--tag <tags>` | Runs only the tests with one of these tags, theirs or their `describe` blocks' (repeat it, or use commas) |
| `--exclude-tag <tags>` | Leaves out the tests with any of these tags, whatever else selects them |
| `--repeat-each <n>` | Runs every test n times; a test passes when every run passes (a test's own `repeats` wins) |
| `-c, --config <file>` | The configuration file |
| `-r, --root <dir>` | The project root (the current directory by default) |
| `-w, --maxWorkers <n\|n%>` | Workers; by default, from the durations of the last run |
| `-i, --runInBand` | Everything in the main thread |
| `--pool <threads\|forks\|inline>` | Worker threads (default), child processes, or the main thread |
| `--no-isolate` | Shares project modules between the files of a worker |
| `--testTimeout <ms>` | The timeout of tests (5000) |
| `--reporter <name>` | What is printed (`default`, `verbose`, `json`) and written (`junit`, `markdown`, `github`); repeat it or use commas (see [Reports](../guide/ci.md)). `--verbose` for every test |
| `--retry <n>` | Retries failing tests |
| `--bail <n>` | Stops after `n` failed files |
| `--silent` | Hides what the tests write to the console |
| `--passWithNoTests` | Succeeds when there are no test files |
| `-u, --update` | Writes the snapshots that changed |
| `--ci` | Does not write new snapshots |
| `--coverage` | Reports the coverage of the project |
| `--coverageDirectory <dir>` | Where the coverage reports go (`coverage`); vitest's `--coverage.reportsDirectory` is accepted too |
| `--fail-on-flaky` | Fails the run when a test passed only on a retry (see [Retries](../guide/async.md)); also `--failOnFlaky` |
| `--project <name>` | Runs only these projects (repeat it, or use commas; see [Projects](../guide/projects.md)) |
| `--watch`, `--watchAll`, `vyntra watch` | Runs the tests, then what each change touches, until q (see [Watch mode](../guide/running.md)) |
| `vyntra bench`, `--outputJson <file>`, `--compare <file>` | Runs the benchmarks (`*.bench.*`, or `benchmark.include`), one file at a time; saves their results, or compares with saved ones (see [Benchmarks](../guide/running.md)) |
| `--typecheck`, `--typecheck.only` | Checks the types of the `*.test-d.ts` files with the project's `tsc`, each error failing its test; `.only` runs nothing else (see [Type tests](../guide/running.md)) |
| `--last-failed` | Runs only the tests that failed, until they pass (see [Rerunning failures](../guide/ci.md)); also `--lastFailed` |
| `--outputDir <dir>` | Where the run's report goes (`.vyntra`) |
| `--shard <index>/<total>` | Runs one slice of the test files (from 1), the same on every machine, for CI jobs in parallel (see [Sharding](../guide/ci.md)) |
| `--splitFiles` | Runs long files in parts on several workers (see `splitFiles`) |
| `--allowOnly` | Accepts `.only` (on by default) |
| `--no-color` | Plain output (also with `NO_COLOR`) |
| `-h, --help`, `-v, --version` | Help, version |
| `vyntra guide [topic]` | Prints this documentation, from the copy in the package (no topic: the list of topics) |
| `vyntra init --agents` | Writes `.agents/skills/vyntra/SKILL.md`, which tells coding agents how to run, read and fix the tests, links `.claude/skills/vyntra` to it for Claude Code, and points `AGENTS.md` at it when the project has one (`--dir` writes one copy elsewhere, `--force` replaces it) |

## Exit codes

The exit code tells a broken test from a broken setup, for CI and coding agents:

| Code | Meaning |
| --- | --- |
| `0` | Every test passed |
| `1` | A test or hook failed, a worker died running a file, or coverage is under its threshold |
| `2` | The setup is broken: the config does not load, no test files are found (without `--passWithNoTests`), a file or a setup file does not load, an `.only` with `allowOnly: false`, an invalid `--shard`. It wins over `1`: some tests never ran |
| `3` | Something outside the project that the tests need did not answer (for the API and browser tests to come) |
| `4` | vyntra itself failed: please report it |
| `130` | Interrupted (Ctrl+C): the running files are stopped |
