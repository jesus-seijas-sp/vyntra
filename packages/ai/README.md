# @vyntra/ai

AI steps for [vyntra](https://www.npmjs.com/package/vyntra): an agent that drives a page toward a goal stated in
words and judges claims about it, and `expect(value).toSatisfy(claim)` for values a rule can't check easily
(generated text, a summary, a translation). Every result goes through a **replay cache** committed to the
repository, so a step calls the model once, and later runs (CI among them) reuse the result with no credentials
and no model calls until the step's input changes.

```sh
npm install --save-dev vyntra @vyntra/ai
# for the agent, the web engine too:
npm install --save-dev @vyntra/web playwright
```

```js
// vyntra.config.js
module.exports = {
  projects: [
    { name: 'unit', include: ['src/**/*.test.ts'], engine: 'ai' },
    { name: 'e2e', include: ['e2e/**/*.e2e.ts'], engine: ['web', 'ai'] },
  ],
};
```

```js
test('the summary mentions the refund', async () => {
  const summary = await summarize(order);
  await expect(summary).toSatisfy('mentions the refund of 12 EUR');
  await expect(summary).not.toSatisfy('apologizes for a delay');
});

test('a member upgrades to Pro', async ({ page, agent }) => {
  await page.goto('/settings/billing');
  await agent.act('upgrade the workspace to the Pro plan');
  await agent.assert('the page says the workspace is on the Pro plan');
  expect(await agent.extract('the monthly price, in euros', { type: 'number' })).toBe(20);
});
```

## Steps

| API | What it does |
| --- | --- |
| `expect(value).toSatisfy(claim)` | A model judges a claim about the value; `.not` too. Any project with `engine: 'ai'` |
| `agent.act(goal, { params }?)` | Drives the page to the goal: clicks, fills, presses keys, picks options, opens URLs. `{name}` in the goal takes `params.name`. Returns `{ summary, actions }` |
| `agent.assert(claim)` | Judges a claim about the page as it is; fails the test when it does not hold |
| `agent.waitFor(condition, { timeout, interval }?)` | Waits until a claim about the page holds (30 s and every 500 ms by default), judging the page again only when it changed |
| `agent.extract(what, schema?)` | Reads something off the page: text, or a value of the JSON schema given, checked against it |

`waitFor` reads the page every `interval` ms but asks the model only about a page it has not judged yet, so a
wait on an idle page costs one call. Its judgments are recorded like `assert`'s; in `replay` mode a page with
no recording is not judged at all (the states a page passes through differ from run to run), and the wait goes
on until a page recorded as holding appears. A `waitFor` that holds counts as a check for the `act` before it.

When an `act` can not reach its goal, the agent gives up and says why, and the test fails with a
`BlockedError` whose code names the reason. The run's exit code follows it, so CI can tell a broken product
from a broken setup:

| Reason | Code | Exit |
| --- | --- | ---: |
| The app does not do it, or does it wrong | `AGENT_BLOCKED_PRODUCT` | 1 |
| An interaction the agent's tools can not do | `AGENT_BLOCKED_UNSUPPORTED` | 1 |
| A sign-in was rejected, or there is no account | `AGENT_BLOCKED_CREDENTIALS` | 2 |
| Data or a prerequisite the test should have prepared is missing | `AGENT_BLOCKED_SETUP` | 2 |
| The app or a service it needs is down or erroring | `AGENT_BLOCKED_ENVIRONMENT` | 3 |

A judgment has three outcomes: the claim holds, it fails, or it is **inconclusive**, when the value or the
page does not show enough to decide (another screen, data still loading, a value not there). An inconclusive
judgment fails the test with an `InconclusiveError` (code `ASSERTION_INCONCLUSIVE`), for `.not.toSatisfy`
too, rather than passing or failing on a guess. `extract` fails the same way when the page does not show what
it asks for, instead of returning a placeholder; an answer that breaks the schema gets one more model call,
told what was wrong, and fails the step if it still does.

The agent sees the page as its accessibility tree, read once the page stops changing (no request waiting for
its response, and two reads of the tree that agree); it waits for that after every action, recorded or replayed, and names elements
the way the tree does: a role and its name, a label, a placeholder, a text. Claims should be ones a person
could check from the value or the page.

## The project's words

`use.ai.context` and `use.ai.system` go to different readers. `context` answers "what does this app call
things?" and reaches every model call, judges included: a judge that does not know "plans are called tiers"
can not check that a tier was chosen. `system` answers "how should the agent work?" and reaches only the
agent that acts: an instruction such as "a step is done once the form closes" must not lower a judge's bar.

A test adds what only it knows with `agent.addContext('The seeded workspace is "Acme Trial".')`, for its
later steps (in a `beforeEach` for a whole group). Keep instructions out of it, as it reaches the judges.

Recordings are keyed by the context too: steps run with other vocabulary record again. Instructions are not
part of the key.

## Values that change every run

Test data that differs from run to run (a timestamped email, a fresh company name) goes in as `unique()`, so
the steps that use it still replay:

```js
const { unique } = require('@vyntra/ai');

const email = `ada+${Date.now()}@example.test`;
await agent.act('sign up with the email {email}', { params: { email: unique(email) } });
await expect(page.getByRole('status')).toHaveText(`Welcome ${email}`);
```

The model sees the value as it is. The replay cache sees `<unique:email>` wherever the value shows: in the
goal, on the page (so later `assert`, `waitFor` and `extract` steps match too), in what the agent typed and
in what the step changed; as written, URL-encoded or JSON-escaped. A replay types the value of its own run. Keep
values that choose the flow (a plan name) as plain params: changing those should record again.

## Secrets

A password or a key goes to an agent as a `secret()`: a handle with a name and no readable value.

```js
const { secret, fillSecret } = require('@vyntra/ai');

test('signs in', async ({ page, agent }) => {
  const password = secret('ADMIN_PASSWORD'); // the environment variable's value; or secret('admin', fromVault())
  await page.goto('/login');
  await agent.act('sign in as {user} with the password {password}', { params: { user: 'ada', password } });
  await expect(page.getByRole('status')).toContainText('Welcome ada');
});

// Typing it yourself, into a field you chose:
await fillSecret(page.getByLabel('Password'), password);
```

- The model sees `<secret:ADMIN_PASSWORD>` and types it with a `type_secret` action naming it; the runner
  fills the value, only into an editable field, and only for a secret in that step's `params`.
- The value is hidden wherever it would show: in what the model reads (the page, its address and title, an
  error), in recordings (`type_secret` records the name, and a replay types the value the secret has then),
  in failure pages, attachments, errors and console output, as written, in any letter case, and
  JSON-, URL- or HTML-encoded.
- Once a secret was typed, the attempt keeps no screenshot and no Playwright trace: the app may show the
  value anywhere on the screen, and a trace records what was typed.
- A value must be at least 6 characters, as a shorter one would hide ordinary text. A transformed value (its
  last four characters, a hash, base64) is another text and is not hidden.

## What the agent may do

The app under test is not trusted: a page can say anything, including "ignore your goal".

- What the page shows reaches the model inside `<page>` delimiters (`<input>` for a judged value), with the
  instruction to treat it as data, never as instructions. A delimiter the page holds itself is defused, so the
  page can not end the data early and pass for the test's words.
- Every tool call is checked against the tool's schema before it runs, whatever the provider enforces: an
  unknown tool, a missing or extra field, or a wrong type is refused, and the model reads why.
- `goto` opens only `http` and `https` addresses, or paths of the site: `file:`, `data:`,
  `javascript:` and the like are refused, in recorded actions too.
- Actions name elements (role and name, label, text); the runner never runs model text as code or selectors.
- An `act` can not go round in circles: an action the model already took on the very same page is refused
  (it changed nothing then). After 3 failed actions in a row the model is told to change approach; after 5,
  and on the last turn the step allows (`use.ai.maxSteps`), it is offered only `done` and `give_up`. Three
  turns before the limit it is told how many are left.

## The replay cache

A step's result is recorded under a hash of the step (its claim or goal), its input (the value, or the page's
route, its title and its accessibility tree), the model and the prompts. A run reuses a recorded result while
that hash stays the same, so a changed value or page asks the model again.

A page's route is its path and query, without the origin (the same whichever port or preview host the app
runs on) and the fragment, with ids, tokens and timestamps read as placeholders: `/orders/42?t=1727780000`
and `/orders/7?t=1727780999` are one route, as are two runs of a test that opens `/?list=<a fresh uuid>`.
Everything else counts: `/companies` and `/companies?tab=notes`, or `/products/summer-sneaker` and
`/products/winter-boot`, are different pages. The model still sees the address as it is.

- Recordings go to `vyntra.ai-cache/<test file>/<test>.json` (`use.ai.cacheDir` moves it). Commit the
  directory: a diff shows a reviewer when a verdict or an agent's actions changed.
- `agent.act` records the actions it took and what they changed: the route it ended on, and up to 8 lines
  of the accessibility tree that appeared and 8 that went away (alerts and status messages first; times,
  dates and ids left out). A later run replays the actions without the model, then checks the page ends
  the same way, and that part of it changed during the replay. When a replayed action no longer finds its
  target, or the page ends another way, the model takes over from that point (in `replay` mode, the step
  fails and says why).
- An `act` is recorded only when a later check in the same test passes: an assertion on the page or a
  locator (`expect(page.getByRole('status')).toHaveText(...)`), or `agent.assert`. Until something checks
  it, what the model did is not known to be right. Follow each `act` with a check; one that nothing
  checks, or that changed nothing a replay could check, calls the model every run and fails in `replay`
  mode.
- When a test fails, the recordings it can no longer vouch for are dropped: a replayed `act` that no check
  confirmed before the failure, and one the model had to take over from without a check confirming the
  new actions.
- A new recording of a claim replaces the one made on an older input, so files keep one result per step.

### What a run spent

The run's summary says what the AI steps cost and how the cache served them, and `.vyntra/report.json` holds
the same under `engines`:

```text
 Test Files  4 passed (4)
      Tests  13 passed (13)
         AI  9.6k tokens · 4 model calls · deepseek/deepseek-v4-flash · deepseek/deepseek-v4-pro
      Cache  0 replayed · 0 handed off · 2 missed
```

`replayed` steps came from a recording with no model call, `handed off` ones replayed until the page changed
and the model took over, `missed` ones had no recording. Under `--ai live` the cache is off and only usage
shows.

### Modes

`--ai <mode>` on the command line, or `use.ai.mode`:

| Mode | What it does |
| --- | --- |
| `replay` | Recorded results only; a step that was not recorded fails and says how to record it. The default when `CI` is set |
| `record` | Replays what is recorded and asks the model for the rest. The default elsewhere |
| `live` | Asks the model every time, and records nothing |
| `off` | Skips the tests that reach an AI step |

## Options

In `use.ai`:

| Option | Default | |
| --- | --- | --- |
| `model` | `claude-opus-5-5` with `anthropic`; the account's default with `openrouter` | The model asked |
| `effort` | `medium` | How hard it thinks: `low`, `medium`, `high`, `xhigh`, `max` |
| `mode` | `record` (`replay` under `CI`) | See above; `--ai` wins over it |
| `cacheDir` | `vyntra.ai-cache` | Where recordings go, from the project root |
| `budget` | `{ calls: 200, tokens: 2_000_000 }` | What one run may spend over all its workers. Past it, AI steps fail and the run ends with exit code 3 |
| `maxSteps` | `25` | Model turns `agent.act` may take for one goal |
| `actionTimeout` | `5000` | How long one action waits for its target (ms) |
| `judge` | the acting model | The model for judgments (`assert`, `waitFor`, `extract`, `toSatisfy`): a model name on the same provider, or `{ provider, model, effort, baseURL }`. `VYNTRA_AI_JUDGE_MODEL` names one too. A cheap model can act while a strong one judges; recordings name the model that answered, and a new judge records the judgments again but not the actions |
| `context` | | What the app calls things (screens, menus, terms), read by every model call, judges included. At most 16 KiB |
| `system` | | Instructions for the agent that acts (verify a confirmation before finishing, close unasked-for notices). Judges never read them. At most 16 KiB |
| `provider` | `'anthropic'` | `'openrouter'`, `'openai'` (with `baseURL` for other hosts of its API), or the path of a module exporting a provider |

`provider` and `model` can also come from the environment, `VYNTRA_AI_PROVIDER` and `VYNTRA_AI_MODEL`, so a
machine or a CI job chooses them without a config change (`use.ai` wins). Recordings are keyed by both: a CI job
replays them only with the provider and model they were recorded with, which are no secrets to set there.

The engine raises `testTimeout` to 120 s and `hookTimeout` to 60 s, as a step being recorded waits for the
model; the project's own values win.

## Credentials

Only a step that calls the model needs them, from the environment, never the config: `ANTHROPIC_API_KEY` (or
`CLAUDE_API_KEY`) for `anthropic`, `OPENROUTER_API_KEY` for `openrouter`, `OPENAI_API_KEY` (and
`OPENAI_BASE_URL`, or `use.ai.baseURL`) for `openai`: OpenAI itself, or any host of its Chat Completions API,
Ollama and other local servers among them. Without `use.ai.model`, OpenRouter answers with the account's
default model, and the recordings name the model that answered; changing that default does not make them
miss. A key of the organization rather than of a workspace also needs
`ANTHROPIC_WORKSPACE_ID`. Requests that a safety classifier declines are run again on the model Anthropic
recommends for them (server-side fallbacks). An error of the API (credentials, an outage, rate limits after
the retries) fails the step as a problem of the environment: the run ends with exit code 3.

## Providers

A provider is an object with a `name` and one method, a model turn:

```ts
interface Provider {
  name: string;
  complete(request: {
    model: string;
    effort?: string;
    system?: string;
    messages: Message[]; // the Messages API's shape: text, tool_use and tool_result blocks
    tools?: { name: string; description: string; inputSchema: object }[];
    schema?: object; // when given, the answer is JSON of this shape
    signal?: AbortSignal;
  }): Promise<{
    message: Message; // what goes back into the conversation
    text: string;
    json?: unknown;
    toolCalls: { id: string; name: string; input: object }[];
    usage: { inputTokens: number; outputTokens: number };
  }>;
}
```

`use.ai.provider: './test/my-provider.js'` loads one from the project (an object, or a class of one).

## When a step fails

`--ai-trace` writes every model call of the run to `.vyntra/ai-trace.jsonl`, one JSON line each: the test and
step, the model, what it was sent (secret values hidden), what it answered, the tokens and the time. The
summary then names the file and lists the slowest steps:

```text
   AI trace  .vyntra/ai-trace.jsonl · 3 model calls
      Steps  act "add a todo called "Buy milk"" · 2 calls · 6.1k tokens · 4.1s
             assert "the list has exactly one todo, Buy milk" · 1 call · 350 tokens · 3.1s
```

Replayed steps make no call and leave no trace: add `--ai live` to trace a whole flow. The file stays on your
machine; a new run clears it.


The failure page of the `markdown` report shows each AI step of the test: where its result came from (the
recording, or the model), the verdict and its reasoning or the actions taken, and the last turns with the
model.
