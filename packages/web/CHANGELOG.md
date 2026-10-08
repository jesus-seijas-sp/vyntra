# @vyntra/web

## 0.1.0

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

- 94f0e6f: Coverage in browser mode: `--coverage` takes Chromium's V8 coverage of each page and maps it through the bundle's source map onto the project's files, the same lines, functions and branches as in Node. Code no test reaches is reported uncovered instead of being tree-shaken away. In Node, the coverage of compiled files (TypeScript) no longer counts the module itself as one of their functions.
- 98032ab: Browser mode: a project with Vitest's `browser.enabled` runs its test files in real browser pages, through `@vyntra/web` on Playwright. Each file is bundled with the project's esbuild together with vyntra's runtime for pages, and served to a page of its own. `vitest/browser` gives `page` (locators, viewport, screenshot) and `userEvent`, whose actions Playwright performs; `expect.element` retries, jest-dom's matchers are there, and `vi.mock` works with factories (async, with `importOriginal`) or as automocks. Failures and console output point at the test's files.
- ab0d022: Snapshots in browser mode: `toMatchSnapshot` and `toMatchInlineSnapshot` work in browser pages, with `-u`, the page's results written by Node. DOM nodes now print as pretty-format's DOM plugins print them (attributes one per line, children indented), so stored Jest and Vitest snapshots of elements match; `NodeList` and `HTMLCollection` print as lists. New snapshot files of Vitest projects get Vitest's header and `suite > test` names. A failed test's snapshots it did not reach are no longer obsolete, so `-u` keeps them.
- e1b4927: The WebdriverIO provider of browser mode: `provider: 'webdriverio'`, or vitest 4's `webdriverio()` (whose package, like `@vitest/browser-playwright`'s, a config can import without it installed), runs test files in Chrome, Firefox, Edge or Safari through WebDriver, with the same `page`, `userEvent`, locators, mocks and snapshots. Pages now talk to the runner through its local server for both providers. The factory's options go to WebdriverIO's `remote()`.

  Safari runs one session at a time, so its test files run one after the other; full-page screenshots, which need WebDriver BiDi, say so where a session lacks it.

- c495899: The first release of `@vyntra/web`: end-to-end web tests on Playwright for projects with `engine: 'web'`. A browser per worker and a fresh context and page per test; web-first assertions that retry (`toBeVisible`, `toHaveText`, `toHaveURL`...); and, for a failed test, a screenshot, the accessibility tree, the console, the network and a Playwright trace on its failure page.

### Patch Changes

- Updated dependencies [ce3f099]
- Updated dependencies [cbdfc2f]
- Updated dependencies [ff89cda]
- Updated dependencies [58166f7]
- Updated dependencies [94f0e6f]
- Updated dependencies [98032ab]
- Updated dependencies [ab0d022]
- Updated dependencies [e1b4927]
- Updated dependencies [88d585f]
- Updated dependencies [91142c8]
- Updated dependencies [cb55154]
- Updated dependencies [48456aa]
- Updated dependencies [a2a90e0]
- Updated dependencies [0d74fbd]
- Updated dependencies [a1349fd]
- Updated dependencies [d95e4b9]
- Updated dependencies [6c42968]
- Updated dependencies [6a9de7b]
- Updated dependencies [14b2142]
- Updated dependencies [a92335b]
- Updated dependencies [9a1c29e]
- Updated dependencies [2b6e0d9]
- Updated dependencies [2fbdc4c]
- Updated dependencies [dead553]
- Updated dependencies [89461f8]
- Updated dependencies [12eeb6f]
- Updated dependencies [eda1375]
- Updated dependencies [cb5601f]
- Updated dependencies [85d46bb]
- Updated dependencies [dee2977]
- Updated dependencies [10aa5fe]
  - vyntra@0.7.0
