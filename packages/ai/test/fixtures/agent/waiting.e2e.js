// A page that finishes loading after a moment, and one where nothing ever happens.
test('waits until the page says it is done', async ({ page, agent }) => {
  await page.setContent(`
    <title>Report</title><p role="status">Loading…</p>
    <script>setTimeout(() => { document.querySelector('[role=status]').textContent = 'Done loading'; }, 1200);</script>`);
  await agent.waitFor('mentions Done loading', { interval: 200 });
});

test('gives up after its timeout, saying what it last saw', async ({ page, agent }) => {
  await page.setContent('<title>Report</title><p role="status">Loading…</p>');
  await expect(agent.waitFor('mentions never', { timeout: 1500, interval: 300 })).rejects.toThrow(
    'agent.waitFor(condition) timed out after 1500ms'
  );
});
