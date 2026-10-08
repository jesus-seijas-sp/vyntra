# vyntra

## 0.7.0

### Minor Changes

- ce3f099: `@vyntra/ai`, the AI engine: `expect(value).toSatisfy(claim)` in any project with `engine: 'ai'`, and an `agent` fixture with `act(goal)`, `assert(claim)` and `extract(what, schema)` on the page of `@vyntra/web` (`engine: ['web', 'ai']`). Results go through a replay cache committed to the repository (`vyntra.ai-cache/`, one file per test), keyed by the step, its input, the model and the prompts: CI replays with no credentials and no model calls, and a replayed `act` whose action no longer finds its target hands over to the model. `--ai replay|record|live|off`, a per-run budget of calls and tokens over all workers, Claude through the Anthropic SDK with server-side fallbacks, OpenRouter and any OpenAI-compatible host (`VYNTRA_AI_PROVIDER` and `VYNTRA_AI_MODEL` choose them from the environment), and providers of the project's own. In the core: a project may name several engines, `vyntra/engine` gives engines the running test, the replay cache and `EnvironmentError`, and a test that fails with an error of the environment ends the run with exit code 3.

  An `act` is recorded only when a later check in the test passes, together with what it changed on the page; a replay checks the page ends the same way and hands over to the model (or fails, under `--ai replay`) when it does not, and a failed test drops the recordings it can no longer vouch for.

  Secrets: `secret()` handles for passwords and keys, typed by the runner through a `type_secret` action the model calls by name; their values are hidden from prompts, recordings, failure pages, errors, console output and attachments, and an attempt that typed one keeps no screenshot or trace. `agent.act` takes `params` for the `{name}`s in its goal.

  Rules for the agent: the page reaches the model as data it can not break out of, every tool call is checked against its schema before it runs, and navigation goes only to http and https addresses.

  Loop guards: an act refuses an action already taken on the same page, tells the model to change approach after 3 failed actions in a row, and asks for a verdict after 5 and on its last turn.

  Recordings are keyed by the page's route: path and query without the origin and the fragment, with ids, tokens and timestamps read as placeholders.

  Judgments can be inconclusive when the value or the page does not settle the claim, failing the test as such; extract checks its answer against the schema (one repair call) and fails as inconclusive when the page does not show the value, instead of returning a placeholder.

  `agent.waitFor(condition)` waits until a claim about the page holds, asking the model only when the page changed, and replays with no model calls.

  `unique()` params for values that change every run: the model types them as they are, recordings hold `<unique:name>`, and a replay types the value of its own run.

  An agent that gives up says why (product, environment, credentials, setup, unsupported), and the run exits 3 for the environment and 2 for credentials and setup, as for any test error with that phase.

  `use.ai.context` gives the app's vocabulary to every model call, judges included, and `use.ai.system` gives instructions to the acting agent only; `agent.addContext()` adds what one test knows.

  `use.ai.judge` (or `VYNTRA_AI_JUDGE_MODEL`) gives judgments a model of their own, so a cheap model can act while a strong one judges.

  The run summary and report.json say what the AI steps cost (tokens, model calls, models) and how the replay cache served them (replayed, handed off, missed); engines can add lines to the summary through `summarize()`.

  `--ai-trace` writes every model call to `.vyntra/ai-trace.jsonl`, secret values hidden, and the summary lists the slowest traced steps. Engines can name output files the core clears when a run starts.

  Tags on `describe` and `test` (`{ tags: ['slow'] }`), with `--tag` and `--exclude-tag`; `--grep` (as `-t`) and `--grep-invert`; and `--repeat-each <n>` to run every test n times.

  `vyntra init --agents` writes the skill to `.agents/skills/vyntra`, links `.claude/skills/vyntra` to it, and points an existing `AGENTS.md` at it; the skill now covers AI steps.

  `@vyntra/mcp` gains live sessions: `open_session` starts the app as the tests see it, and `observe`, `act`, `locate` (the locator to write), `screenshot` and `close_session` work on it, several at once for subagents. The core exports `vyntra/tooling` for it.

  `vyntra explore '<goal>'`: an agent explores the app with no test file and reports what it finds, issues and warnings with severity, repro steps and screenshots, in `.vyntra/explore.md`; exit 1 on an issue.

  `vyntra init` sets a project up for every kind of test: it asks (or takes flags with `--yes`), then writes the config, example tests, the skill, `.mcp.json`, `.gitignore` and a test script, and prints what to install.

  The agent drags, answers native dialogs its actions open, and acts inside iframes, whose content now follows the page's tree.

  Vision: the agent can ask for a screenshot and click a point of it, and `assert`, `waitFor` and `extract` take `vision: true | 'only'`; `use.ai.vision` (or `VYNTRA_AI_VISION_MODEL`) sends the calls that carry a screenshot to a model that reads images.

  After each action the agent gets a diff of the page against what it last saw, not the whole page again (`use.ai.diffs: false` to turn it off).

  The tools are smaller: how to name an element is said once in the act prompt, not on every field of every tool, which takes the tools sent with each call from 12.7k to 7.9k characters.

  On Windows, a project's `server` is now stopped with the process tree it started: stopping the shell alone left the server running after the run.

- cbdfc2f: API testing: the built-in `api` fixture is an HTTP client for the test (JSON in and out, `use.baseURL` or the server's address, cookies kept for the test), and `toHaveStatus`, `toHaveHeader` and `toMatchSchema` (JSON Schema) check its responses. Every request and response is recorded, and the failure page of a test shows them with the server's output.
- ff89cda: Async hooks run: a Jest transformer with only `processAsync`, and Vite plugins' `resolveId`, `load` and async `transform` hooks (virtual modules included), on a helper thread the module hooks wait for. Plugin transforms now apply to every project ES module, not only the ones vyntra compiles, as in Vitest.
- 58166f7: Benchmarks: `vyntra bench` runs the `*.bench.*` files (Vitest's `benchmark` options too) one at a time. `bench(name, fn, { time, iterations, warmupTime, warmupIterations, setup, teardown })` measures as tinybench does; each group prints hz, min, max, mean, p75 to p999, margin of error and samples, the summary the fastest of each group. `--outputJson` saves the results and `--compare` shows the change against them.
- 94f0e6f: Coverage in browser mode: `--coverage` takes Chromium's V8 coverage of each page and maps it through the bundle's source map onto the project's files, the same lines, functions and branches as in Node. Code no test reaches is reported uncovered instead of being tree-shaken away. In Node, the coverage of compiled files (TypeScript) no longer counts the module itself as one of their functions.
- 98032ab: Browser mode: a project with Vitest's `browser.enabled` runs its test files in real browser pages, through `@vyntra/web` on Playwright. Each file is bundled with the project's esbuild together with vyntra's runtime for pages, and served to a page of its own. `vitest/browser` gives `page` (locators, viewport, screenshot) and `userEvent`, whose actions Playwright performs; `expect.element` retries, jest-dom's matchers are there, and `vi.mock` works with factories (async, with `importOriginal`) or as automocks. Failures and console output point at the test's files.
- ab0d022: Snapshots in browser mode: `toMatchSnapshot` and `toMatchInlineSnapshot` work in browser pages, with `-u`, the page's results written by Node. DOM nodes now print as pretty-format's DOM plugins print them (attributes one per line, children indented), so stored Jest and Vitest snapshots of elements match; `NodeList` and `HTMLCollection` print as lists. New snapshot files of Vitest projects get Vitest's header and `suite > test` names. A failed test's snapshots it did not reach are no longer obsolete, so `-u` keeps them.
- e1b4927: The WebdriverIO provider of browser mode: `provider: 'webdriverio'`, or vitest 4's `webdriverio()` (whose package, like `@vitest/browser-playwright`'s, a config can import without it installed), runs test files in Chrome, Firefox, Edge or Safari through WebDriver, with the same `page`, `userEvent`, locators, mocks and snapshots. Pages now talk to the runner through its local server for both providers. The factory's options go to WebdriverIO's `remote()`.

  Safari runs one session at a time, so its test files run one after the other; full-page screenshots, which need WebDriver BiDi, say so where a session lacks it.

- 91142c8: Test environments of your own: `environment` (Vitest) or `testEnvironment` (Jest), and a file's `@vitest-environment` / `@jest-environment` comment, can name one by path or package. A Vitest environment's `setup(global, options)` and a Jest environment class (over `NodeEnvironment` or `JSDOMEnvironment`, with `testEnvironmentOptions`) are set up for each of their files and torn down after.
- cb55154: Engines: a project's `engine` (`'web'` is `@vyntra/web`) adds its fixtures and matchers, and its defaults under the options the project sets. Fixtures get `testInfo` (`failed` before they tear down, `outputPath()`, `attach()`), and what they attach to a failed or flaky attempt is shown on its failure page, from `.vyntra/artifacts/`.
- a2a90e0: Exit codes tell a broken test from a broken setup: `1` a test failed, `2` the config or a test file did not load, no test files were found, or an `.only` with `allowOnly: false`; `4` an error of vyntra itself; `130` interrupted, which now stops the running workers.
- a1349fd: Fixtures can be shared: `{ scope: 'file' }` sets one up once per file, `{ scope: 'worker' }` once per worker, torn down when it ends. `[value, { option: true }]` fixtures take their value from the new `use` config option, whose values every test can destructure.
- d95e4b9: A test that passes only on a retry is reported as `flaky`: counted apart in the summary, listed with the errors of the attempts that failed (`attempts` in the JSON results), and failing the run with `--fail-on-flaky`.
- 6c42968: The projects of a Vitest config (`test.projects`, or a `vitest.workspace` file) and of a Jest config (`projects`) run as they are: each from its own folder, with its own config or none, by the name Vitest or Jest gives it. As there, they do not take the root config's options, except Vitest projects with `extends: true`; `inherit: false` does the same in a vyntra project.
- 6a9de7b: The documentation ships in the package as Markdown (`node_modules/vyntra/docs`), and `vyntra guide [topic]` prints it. `vyntra init --agents` writes a skill (`.claude/skills/vyntra/SKILL.md`) that tells coding agents how to run the tests, read a failure page and fix what failed.
- 14b2142: A Jest project with a Babel config and no `transform` runs its files through `babel-jest`, as Jest does (`transform: {}` turns it off).
- a92335b: `import.meta.env` works as in Vitest: it reads `process.env` (so `vi.stubEnv` changes both), over Vite's values (`MODE: 'test'`, `DEV`, `PROD`, `SSR`, `BASE_URL`) and the `VITE_` variables of the project's `.env` files (`envDir` and `envPrefix` from the Vite config). JSON files can be imported by name: `import { version } from './package.json'`.
- 9a1c29e: In-source tests: with `includeSource` (read from Vitest configs too), source files that hold tests in an `if (import.meta.vitest)` block run as test files. `import.meta.vitest` is the test API in the file being run and `undefined` in the modules it imports, as in Vitest.
- 2b6e0d9: Every run writes `.vyntra/report.json` (`outputDir` moves it, `false` turns it off), and `--last-failed` reruns only the tests that failed, and the files that did not load, until they pass. A run that leaves a failure out (a path, `-t`, `--shard`) keeps it for the next `--last-failed`.
- dead553: Projects: `projects` in the config splits the suite into parts with options of their own (files, environment, setup files, `use`, workers), run together and reported under their names, ordered by `dependsOn` (a project is skipped when one it depends on fails), each with its own workers within the run's `maxWorkers`. `--project` runs some of them. `globalSetup` and `globalTeardown` run once in the main process, for the run and for each project, as in Jest and vitest (read from their configs too), and the tests read what they provide with `inject()`.
- 89461f8: `--reporter` takes a list (repeated, or names with commas), and three reporters write the run next to what is printed: `junit` (`.vyntra/junit.xml`), `markdown` (`.vyntra/summary.md` and a page per failed or flaky test with the error, its source line, every attempt, the console output and a rerun command) and `github` (annotations on the failing lines and the job summary; on by itself under GitHub Actions when no reporter is configured). Vitest's `reporters` are read from its config.
- 12eeb6f: The `server` option starts a command before the tests of the run or of a project, waits until its `url` (or `port`) answers, and stops it, and what it started, after them; `reuseExisting` attaches to one already running. A server that does not come up fails the run with exit code 3 and its output. Tests reach it through the `server` fixture, and failure pages end with what it printed.
- eda1375: Add `--shard <index>/<total>` (and the `shard` option) to run one slice of the test files, for CI jobs in parallel. Files are split by size, so every machine computes the same slices.
- cb5601f: Errors in compiled files (TypeScript and JSX through esbuild or TypeScript, a Jest `transform`) are reported at the lines of the source: stack traces, code frames and failure pages go through the source map the compiler leaves. Maps are decoded only for errors that are reported, so passing runs cost nothing more.
- 85d46bb: Type tests: `--typecheck` (or Vitest's `typecheck.enabled`) checks the `*.test-d.ts` files with the project's `tsc` (or `vue-tsc`), as Vitest does: each type error fails the test it is in, errors outside tests fail the file, and errors in source files fail the run unless `ignoreSourceErrors`. `--typecheck.only` runs nothing else. `expectTypeOf` and `assertType` are no-ops at run time.
- dee2977: With `collectCoverageFrom` (or Vitest's `coverage.include`), the coverage report lists the files it matches that no test loaded, at zero, as Jest and Vitest do. Coverage of a project reached through a symlinked folder (macOS's `/var`) is no longer lost, and its test files no longer show in the report.
- 10aa5fe: Watch mode: `vyntra --watch` (or `vyntra watch`, or `--watchAll`) runs the tests, then what each change touches: a changed test file, the test files that loaded a changed module, a new test file, or everything when the config changes. In a terminal, Enter reruns, `a` runs all, `f` the failures, `p` and `t` filter by file and by test name, `q` quits.

### Patch Changes

- 88d585f: Coverage of compiled files (TypeScript and JSX through esbuild or TypeScript) counts the lines of the source: V8's counts of the compiled code are moved through the compiler's source map, and what the map leaves out (types, comments) is not counted as code. They were applied to the source as they were, so the wrong lines showed as covered.
- 48456aa: `vi.doMock()` and the ES modules a test imports: the mocks of a CommonJS test file reach the imports of the ES modules it `import()`s (and those modules are fresh after `vi.resetModules()`, as in an ES module test file); a module resolved before it was mocked gets its mock; an async factory (`importOriginal`) settles before the `import()` after it, as in Vitest (the `import()`s of a file that calls `vi.doMock()` wait for the factories); and `importOriginal()` of a builtin gives the builtin.
- 0d74fbd: An explicit `maxWorkers` (`-w`) is now what splitting long files plans for, whatever the machine's cores.
- 2fbdc4c: On a Node.js older than 22, `vyntra` says it needs Node.js 22 and exits with code 2, instead of failing on the first missing API.
