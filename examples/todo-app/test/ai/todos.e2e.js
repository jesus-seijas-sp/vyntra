const { randomUUID } = require('node:crypto');
const { test: base, expect } = require('vyntra');

// The app on a list of its own. The list's id is in the query, which the recordings are not keyed by.
const test = base.extend({
  app: async ({ page }, use) => {
    await page.goto(`/?list=${randomUUID()}`);
    await expect(page.getByRole('status')).toHaveText('Nothing to do');
    await use(page);
  },
});

// Steps in words: the agent's actions and verdicts are recorded in vyntra.ai-cache/ and replayed in CI.
test('finishes the only todo', async ({ app, agent }) => {
  await agent.act('add a todo called "Buy milk", then mark it as done');
  await expect(app.getByRole('status')).toHaveText('0 of 1 left');
  await agent.assert('the list has one todo, "Buy milk", and it is marked as done');
});

test('reads the count off the page', async ({ app, agent }) => {
  await agent.act('add the todos "Walk the dog" and "Water the plants"');
  await expect(app.getByRole('status')).toHaveText('2 of 2 left');
  expect(await agent.extract('how many todos are left to do', { type: 'integer' })).toBe(2);
});
