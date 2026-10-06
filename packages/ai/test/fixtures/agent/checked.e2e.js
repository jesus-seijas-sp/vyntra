// The Add button appends what was typed; BREAK_EFFECT makes it append something else, so a replay runs every recorded
// action yet does not reach the recorded outcome. FAIL_AFTER fails the test before anything checks the act.
const HTML = `
  <title>Todos</title>
  <input aria-label="Title" />
  <button>Add</button>
  <ul></ul>
  <script>
    document.querySelector('button').addEventListener('click', () => {
      const item = document.createElement('li');
      const title = document.querySelector('input').value;
      item.textContent = ${process.env.BREAK_EFFECT ? "title + '!'" : 'title'};
      document.querySelector('ul').append(item);
    });
  </script>`;

test('an act a check confirms', async ({ page, agent }) => {
  await page.setContent(HTML);
  await agent.act('add the todo Buy milk');
  if (process.env.FAIL_AFTER) {
    throw new Error('something else broke');
  }
  await expect(page.getByRole('listitem')).toHaveText('Buy milk');
});
