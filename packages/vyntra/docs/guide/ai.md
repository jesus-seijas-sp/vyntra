# AI steps

[`@vyntra/ai`](https://www.npmjs.com/package/@vyntra/ai) checks what a rule can not check easily. A project with `engine: 'ai'` gets `expect(value).toSatisfy(claim)`, where a model judges a claim about a value (generated text, a summary, a translation); with `engine: ['web', 'ai']`, tests also get an `agent` on their page that reaches goals stated in words, judges claims about the page and reads values off it:

```sh
npm install --save-dev @vyntra/ai
```

```js
test('the summary mentions the refund', async () => {
  await expect(await summarize(order)).toSatisfy('mentions the refund of 12 EUR');
});

test('a member upgrades to Pro', async ({ page, agent }) => {
  await page.goto('/settings/billing');
  await agent.act('upgrade the workspace to the Pro plan');
  await agent.assert('the page says the workspace is on the Pro plan');
  expect(await agent.extract('the monthly price, in euros', { type: 'number' })).toBe(20);
});
```

A step calls the model once. Its result is recorded in `vyntra.ai-cache/`, one file per test, under a hash of the step, its input (the value, or the page's accessibility tree), the model and the prompts, and later runs reuse it until that input changes. Commit the directory: CI replays the recordings with no credentials and no model calls, and a diff shows a reviewer when a verdict or an agent's actions changed. An `act` is recorded only when a later check in the test passes (an assertion on the page, or `agent.assert`), with what it changed on the page. A replay checks the page ends the same way; when an action no longer finds its target, or the page ends another way, the model takes over and records the step again.

`--ai replay` (the default under `CI`) uses recordings only and fails a step that has none; `--ai record` (the default elsewhere) asks the model for what is missing; `--ai
          live` asks it every time; `--ai off` skips the tests with AI steps. The model is Claude (`ANTHROPIC_API_KEY`), set in `use.ai` with the effort, a budget of calls and tokens for the run (past it the run ends with exit code 3) and a provider of your own. A failed step's page shows the verdict and its reasoning, or the actions taken, and the last turns with the model.

A password or a key goes to an agent as a `secret('ADMIN_PASSWORD')` in the step's `params`: the model sees `<secret:ADMIN_PASSWORD>` and asks the runner to type it, the value is hidden from everything the run reports and records, and the attempt keeps no screenshot or trace once it was typed.

`npx vyntra explore 'Check that adding todos keeps the count right'` runs an exploration with no test file: a planner picks the steps, the agent carries them out, and a reviewer reports what is wrong, each finding with its severity, what was expected and observed, the steps to reproduce it and a screenshot, in `.vyntra/explore.md`. It exits 1 when it found an issue.
