// The project's vocabulary and instructions, and what this test adds to the vocabulary.
const HTML = `
  <title>Todos</title>
  <input aria-label="Title" />
  <button>Add</button>
  <ul></ul>
  <script>
    document.querySelector('button').addEventListener('click', () => {
      const item = document.createElement('li');
      item.textContent = document.querySelector('input').value;
      document.querySelector('ul').append(item);
    });
  </script>`;

test('adds a todo with the words of the project', async ({ page, agent }) => {
  agent.addContext('The seeded list is called "Groceries".');
  await page.setContent(HTML);
  await agent.act('add the todo Buy milk');
  await expect(page.getByRole('listitem')).toHaveText('Buy milk');
  await agent.assert('mentions Buy milk');
});
