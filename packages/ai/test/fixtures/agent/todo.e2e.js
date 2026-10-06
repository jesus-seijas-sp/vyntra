// The button shows once there is a title; BREAK_PAGE renames it, so a recorded click on "Add" no longer finds it.
const HTML = `
  <title>Todos</title>
  <h1>Todos</h1>
  <input aria-label="Title" />
  <span id="actions"></span>
  <ul></ul>
  <script>
    const input = document.querySelector('input');
    input.addEventListener('input', () => {
      const actions = document.querySelector('#actions');
      if (input.value && !actions.firstChild) {
        const button = document.createElement('button');
        button.textContent = ${JSON.stringify(process.env.BREAK_PAGE ? 'Save' : 'Add')};
        button.addEventListener('click', () => {
          const item = document.createElement('li');
          item.textContent = input.value;
          document.querySelector('ul').append(item);
        });
        actions.append(button);
      }
    });
  </script>`;

test('adds a todo by its goal', async ({ page, agent }) => {
  await page.setContent(HTML);
  await agent.act('add the todo Buy milk');
  await expect(page.getByRole('listitem')).toHaveText('Buy milk');
  await agent.assert('mentions Buy milk');
  expect(await agent.extract('the first todo')).toBe('Buy milk');
});
