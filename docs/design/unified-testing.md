# Design: unit, API, end-to-end and AI testing in one runner

Status: proposal · Author: Jesús Seijas · Last updated: 2026-10-06

## Summary

vyntra today is a fast, zero-dependency runner for unit and component tests with a Jest/Vitest
compatible API. This document proposes growing it into one framework for **unit, API and end-to-end
tests, with AI-assisted steps and assertions**, without making the unit path slower or heavier.

The shape: the core stays a zero-dependency runner, and everything heavier is an **opt-in engine
package loaded from the project** (the way happy-dom and jsdom are loaded today). Test kinds become
**projects** in one config, glued together by **fixtures**. AI results go through a **record-and-replay
cache**, so CI runs are fast and deterministic and make no model calls unless something changed.

## Goals

1. One CLI, one config, one report and one CI setup for unit, API and end-to-end tests.
2. The unit path keeps its speed: a run with only unit tests loads nothing new and is within 2% of
   today's benchmarks.
3. The core keeps its promise of no runtime dependencies. Browsers, models and HTTP tooling come
   from optional packages the project installs.
4. Jest/Vitest test files keep working unchanged.
5. AI steps are cheap and reproducible: a run reuses recorded verdicts and actions, and only calls a
   model when the input those depend on has changed.
6. Coding agents can run tests, read failures and write tests without a human in the loop.

## Non-goals

- Reimplementing a browser driver. The web engine builds on Playwright.
- Mobile apps (iOS/Android). A later engine could follow the same interface.
- A hosted service. Everything runs locally or in the user's CI.
- Visual regression testing (pixel diffs) in the first versions.

## What exists today

The proposal builds on parts vyntra already has:

| Part | Today | Used by |
| --- | --- | --- |
| Pools | `threads`, `forks`, `inline`; worker replacement after failures and past a memory limit | Per-project pools |
| Environments | `node`, `happy-dom`, `jsdom`; per-file docblocks; one environment per worker | Projects |
| Fixtures | `test.extend()` with lazy setup, dependencies between fixtures, `auto` | Engine fixtures |
| Isolation | Per-file module isolation, global and DOM reset between files | Unit and API projects |
| Scheduling | Timing-based ordering, `splitFiles` to spread one long file across workers | All projects |
| Reporters | `default`, `verbose`, `json` | The new reporters |
| Caches | Compiled sources, resolutions, timings in `node_modules/.cache/vyntra` | The AI cache's sibling |
| Plugins | Synchronous Vite `transform` hooks from the config | Unchanged |

## Architecture

```
vyntra                 core: collect, run, expect, mocks, pools, projects, fixtures,
                       reporters, sharding, replay cache            (zero dependencies)
├── @vyntra/web        browser engine on Playwright               (peer dependency: playwright)
├── @vyntra/ai         model providers, agent.act / agent.assert, toSatisfy
└── @vyntra/mcp        MCP server for coding agents              (may live in core: see open questions)
```

API testing needs no package: Node's own `fetch` and `child_process` are enough, so it lives in the
core.

Engines are found the way environments are found today: `require` from the project's root, and only
when a project names them. A project that never mentions `web` or `ai` never loads them.

## Projects

A project is a named slice of the suite with its own files, environment, pool and policies. The top
level of today's config becomes the default project, so existing configs keep working.

```js
// vyntra.config.js
module.exports = {
  // Shared by every project unless a project overrides it.
  setupFiles: ['test/setup.ts'],
  reporter: ['default', 'junit'],

  projects: [
    {
      name: 'unit',
      include: ['src/**/*.test.{ts,tsx}'],
      environment: 'happy-dom',
      pool: 'threads',
    },
    {
      name: 'api',
      include: ['tests/api/**/*.test.ts'],
      environment: 'node',
      server: { command: 'npm run start:test', url: 'http://localhost:4000/health', reuseExisting: true },
      use: { baseURL: 'http://localhost:4000' },
    },
    {
      name: 'e2e',
      include: ['tests/e2e/**/*.e2e.ts'],
      engine: 'web',
      pool: 'forks',
      maxWorkers: 4,
      retry: 1,
      testTimeout: 60_000,
      dependsOn: ['api'],
      use: { baseURL: 'http://localhost:4000', browser: 'chromium' },
    },
  ],
};
```

| Key | Meaning |
| --- | --- |
| `name` | Shown in reports; selects the project with `--project <name>` |
| `include` / `exclude` | The project's files. A file belongs to the first project that includes it |
| `environment`, `pool`, `maxWorkers`, `testTimeout`, `retry`, `setupFiles` | As today, per project |
| `engine` | `web` (and later others): loads the engine package and its fixtures |
| `server` | A process to start before the project and stop after it: `command`, `url` to poll, `timeout`, `reuseExisting`, `env` |
| `use` | Options handed to fixtures (`baseURL`, `browser`, `viewport`, model settings) |
| `dependsOn` | Projects that must pass before this one starts (a failed API project skips e2e) |

Projects run concurrently when their pools allow it, in `dependsOn` order otherwise. One CLI run
reports all of them; `--project` narrows it.

## Fixtures

Every project uses the same fixture model, which vyntra has today through `test.extend()`. Engines
contribute fixtures; tests destructure only what they use, and only that is set up.

```ts
import { test, expect } from 'vyntra';

test('a member upgrades to Pro', async ({ page, api, agent }) => {
  await api.post('/test/seed', { plan: 'free' });
  await page.goto('/settings/billing');

  await agent.act('upgrade the workspace to the Pro plan');
  await expect(page.getByRole('status')).toContainText('Pro');
});
```

New work in the core:

- **Worker-scoped fixtures** (`{ scope: 'worker' }`), set up once per worker and torn down when it
  retires. A browser and a started server are worker-scoped; a page and a seeded database are not.
- **Fixture options from `use`**, so a project sets `baseURL` once.
- **Typed fixtures** through the `test.extend<T>()` generic, for TypeScript projects.

| Fixture | From | Scope | What it is |
| --- | --- | --- | --- |
| `api` | core | test | HTTP client: `get/post/put/patch/delete`, JSON by default, `baseURL` from `use` |
| `server` | core | worker | The project's `server` process: its URL, its output |
| `browser` | web | worker | A Playwright browser |
| `page`, `context` | web | test | A fresh context and page per test |
| `agent` | ai | test | `act`, `assert`, `extract` against the page |

## Shared foundation (milestone 1)

These are useful for unit tests today and needed by every later milestone.

### Sharding

`--shard <index>/<total>` runs one deterministic slice of the suite, the same on every machine.
Files are distributed by recorded duration (vyntra already knows them) rather than by count, so
shards finish close together; with no timings, by path. Jest and Vitest spell it the same way, so CI
configs move over unchanged. An empty shard fails unless `--passWithNoTests` is given.

### Exit codes

| Code | Meaning |
| ---: | --- |
| 0 | Everything passed |
| 1 | At least one test failed |
| 2 | Configuration, collection or policy error (a file that does not load, an `.only` with `--allowOnly=false`) |
| 3 | Environment error (a server that never answered, a browser that did not start, a model provider error) |
| 4 | Internal runner error |
| 130 | Interrupted |

CI and agents can then tell a broken test from a broken setup.

### Rerunning failures

Every run writes `.vyntra/report.json`. `--last-failed` runs only what that report says did not pass,
and keeps owing a test that a filter left out. Same loop locally and in CI.

### Flaky status

A test that fails and then passes on retry is reported as `flaky`, not `passed`, in every reporter.
The summary counts them separately, and `--fail-on-flaky` makes them fail the run.

### Reporters and failure pages

`--reporter` takes a list. New reporters:

- `junit`: `.vyntra/junit.xml`, read by most CI systems.
- `markdown`: `.vyntra/summary.md` plus `.vyntra/failures/<test>.md` for each failed or flaky test, with
  the error and its source line, every attempt, the test's console output, the DOM at failure (unit and
  e2e) or the request and response (API), and links to artifacts. Written for people and for coding
  agents.
- `github`: annotations on the failing lines and a job summary, when `GITHUB_ACTIONS` is set.

### Output directory

```
.vyntra/
├── report.json        the run, every result, every attempt
├── junit.xml
├── summary.md
├── failures/          one page per failed or flaky test
└── artifacts/         screenshots, traces, DOM snapshots, per test and attempt
```

The directory is emptied at the start of a run, except under `--last-failed`, which keeps what the
report it reruns refers to and writes its own under `artifacts/rerun-<n>/`.

## API testing (milestone 2)

- The `api` fixture: a thin client over Node's `fetch` with `baseURL`, JSON bodies and responses,
  headers and cookies kept per test, and the request and response recorded for failure pages.
- Matchers: `toHaveStatus`, `toHaveHeader`, `toMatchSchema` (JSON Schema, a small validator in core).
- The `server` option: start a command, poll a URL until it answers, keep its output for failures, stop
  it when the project ends. `reuseExisting` attaches to a server that is already running.
- Runs in the `node` environment, so it shares today's isolation and speed.

## End-to-end web testing (milestone 3)

`@vyntra/web`, with Playwright as a peer dependency the project installs.

- Fixtures: worker-scoped `browser`, test-scoped `context` and `page`. Locators and web-first
  assertions come from Playwright; vyntra's `expect` delegates to them for locators.
- Browsers: `chromium`, `firefox`, `webkit` through `use.browser`.
- On failure: a screenshot, the page's accessibility tree, the console and the network log, in the
  failure page; a Playwright trace with `use.trace: 'on-failure'`.
- Defaults that suit end-to-end tests: `pool: 'forks'`, low concurrency, `retry: 1`, longer timeouts.

## AI layer (milestone 4)

`@vyntra/ai` adds three things, all going through the replay cache.

| API | Where | What it does |
| --- | --- | --- |
| `agent.act(goal)` | e2e | Drives the page to reach a goal stated in words, recording each action |
| `agent.assert(claim)` | e2e | Judges a claim about the current page |
| `expect(value).toSatisfy(claim)` | any project | Judges a claim about a value: generated text, a summary, a translation |

### Replay cache

The key idea, taken from TesterArmy's e2e: a model call is made once and its result is reused until
the input it depended on changes.

- **Key:** a hash of the claim or goal, the input (the value, or the page's accessibility tree), the
  model and the prompt version.
- **`act`:** records the actions taken. The next run replays them with no model call; if a replayed
  action can no longer find its target, the agent takes over and records again.
- **`assert` / `toSatisfy`:** records the verdict and the model's reasoning.
- **Storage:** a directory meant to be committed (`vyntra.ai-cache/` by default), so CI replays what
  developers recorded.
- **Modes**, through `--ai <mode>` or `use.ai.mode`:
  - `replay`: cached results only; a cache miss fails the step. The CI default.
  - `record`: replay what is cached and call the model for the rest. The local default.
  - `live`: ignore the cache.
  - `off`: skip AI steps.

### Providers and budget

Bring your own provider: Anthropic, OpenAI-compatible endpoints, or a local model, configured once in
`use.ai`. A per-run budget (calls and tokens) stops the run with exit code 3 instead of running up a
bill. Failure pages include each AI step's recent turns.

## Coding-agent support (milestone 5)

- Ship the docs as Markdown inside the npm package, so agents read them offline in
  `node_modules/vyntra/docs`.
- `vyntra guide [topic]` prints a topic. `vyntra init --agents` installs a `SKILL.md` for Claude Code
  and other agents.
- An MCP server (`vyntra mcp`) with tools to run tests (all, a file, a project, `--last-failed`), list
  failures and read a failure page; for e2e, to open a page and try a locator.

## Milestones

| # | Milestone | Done when |
| --- | --- | --- |
| 1 | Shared foundation: sharding, exit codes, `--last-failed`, flaky status, `junit`/`markdown`/`github` reporters | A real project's CI runs sharded with JUnit output; the unit benchmark is unchanged |
| 2 | Projects, worker-scoped fixtures, `use`, API testing with `server` | One config runs unit and API tests; a failing API test's page shows the request and response |
| 3 | `@vyntra/web` on Playwright | The example app's e2e suite passes; failures carry a screenshot and a trace |
| 4 | `@vyntra/ai` with the replay cache | A second run of an AI test makes no model calls; CI runs in `replay` mode with no credentials |
| 5 | Docs in the package, `guide`, skill, MCP server | An agent fixes a failing test from the failure page without other help |

Milestones 1 and 2 stand on their own; 3 and 4 can be built in parallel once 2 is in.

## Risks

| Risk | Mitigation |
| --- | --- |
| The unit path gets slower or heavier | Engines load only when a project names them; a benchmark gate in CI fails a change that slows the unit run by more than 2% |
| End-to-end testing is a large field | Build on Playwright rather than replace it; start with Chromium and add browsers later |
| AI steps are slow, costly and nondeterministic | The replay cache, `replay` mode in CI, budgets, and `toSatisfy` restricted to claims a person can check |
| The replay cache goes stale silently | A replayed `act` re-verifies with the step's assertion; a hit on a changed input is a miss by construction |
| Overlap with Playwright Test and TesterArmy's e2e | The difference is one runner for every kind of test, Jest/Vitest compatibility and speed; interoperate rather than compete (Playwright locators, compatible APIs) |

## Open questions

1. Should the MCP server live in the core (no dependencies, Node's own HTTP and stdio) or in its own
   package?
2. Should the AI cache live in the repository (deterministic CI, larger diffs) or in CI's cache
   (smaller repo, misses on a fresh runner)?
3. Default provider and model for `@vyntra/ai`, and whether `toSatisfy` should be in core with a pluggable
   judge.
4. Should projects be able to share one worker pool, or should each have its own?
5. Is `dependsOn` enough for ordering, or do end-to-end projects need a global setup and teardown as well?
