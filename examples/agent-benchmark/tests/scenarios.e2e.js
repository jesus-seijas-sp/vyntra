const { scenarios } = require('../scenarios');

// The floor: every scenario solved with locators and the browser's own API, no model. A scenario this suite can not
// solve is a gap in the tools, not in the agent.
scenarios.forEach(({ slug, name, success, solve }) => {
  test(`${slug}: ${name}`, async ({ page }) => {
    await page.goto(`/e/${slug}`);
    await solve(page);
    await expect(page.getByRole('status')).toHaveText(success);
  });
});
