const { scenarios } = require('../scenarios');

// The agent on every scenario, from its task in words; the status message decides, not the agent.
scenarios.forEach(({ slug, name, task, success }) => {
  test(`${slug}: ${name}`, async ({ page, agent }) => {
    await page.goto(`/e/${slug}`);
    await agent.act(task);
    await expect(page.getByRole('status')).toHaveText(success, { timeout: 3_000 });
  });
});
