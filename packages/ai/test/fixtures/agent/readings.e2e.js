// What the page does not settle fails as inconclusive; an answer that breaks the schema gets one repair.
const HTML = '<title>Todos</title><ul><li>Buy milk</li></ul>';

test('a claim the page does not settle', async ({ page, agent }) => {
  await page.setContent(HTML);
  await expect(agent.assert('nobody can tell whether the milk is fresh')).rejects.toThrow(
    'agent.assert(claim) is inconclusive'
  );
});

test('a value the page does not show', async ({ page, agent }) => {
  await page.setContent(HTML);
  await expect(agent.extract('the phone number')).rejects.toThrow(
    'agent.extract("the phone number") is inconclusive: the page does not show a phone number'
  );
});

test('an answer that breaks the schema, repaired', async ({ page, agent }) => {
  await page.setContent(HTML);
  expect(await agent.extract('how many todos the list has', { type: 'integer' })).toBe(1);
});
