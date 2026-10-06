// A button that does nothing, and a model that keeps clicking it: the guard stops the loop.
test('a model going round in circles is stopped', async ({ page, agent }) => {
  await page.setContent('<title>Stuck</title><button>Nothing</button>');
  await expect(agent.act('make something happen')).rejects.toThrow(
    'The agent could not reach "make something happen" (product): the button does nothing'
  );
});
