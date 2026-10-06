---
"vyntra": minor
"@vyntra/ai": minor
---

`@vyntra/ai`, the AI engine: `expect(value).toSatisfy(claim)` in any project with `engine: 'ai'`, and an `agent` fixture with `act(goal)`, `assert(claim)` and `extract(what, schema)` on the page of `@vyntra/web` (`engine: ['web', 'ai']`). Results go through a replay cache committed to the repository (`vyntra.ai-cache/`, one file per test), keyed by the step, its input, the model and the prompts: CI replays with no credentials and no model calls, and a replayed `act` whose action no longer finds its target hands over to the model. `--ai replay|record|live|off`, a per-run budget of calls and tokens over all workers, Claude through the Anthropic SDK with server-side fallbacks, OpenRouter and any OpenAI-compatible host (`VYNTRA_AI_PROVIDER` and `VYNTRA_AI_MODEL` choose them from the environment), and providers of the project's own. In the core: a project may name several engines, `vyntra/engine` gives engines the running test, the replay cache and `EnvironmentError`, and a test that fails with an error of the environment ends the run with exit code 3.

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

On Windows, a project's `server` is now stopped with the process tree it started: stopping the shell alone left the server running after the run.
