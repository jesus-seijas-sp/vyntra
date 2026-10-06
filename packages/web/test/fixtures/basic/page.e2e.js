const HTML = `
  <title>Todos</title>
  <h1>Todos</h1>
  <input aria-label="Title" />
  <button>Add</button>
  <ul></ul>
  <script>
    document.querySelector('button').addEventListener('click', () => {
      const input = document.querySelector('input');
      setTimeout(() => {
        const item = document.createElement('li');
        item.textContent = input.value;
        item.className = 'todo open';
        document.querySelector('ul').append(item);
        console.log('added ' + input.value);
        input.value = '';
      }, 300);
    });
  </script>`;

test('adds a todo, waiting for the page', async ({ page }) => {
  await page.setContent(HTML);
  await expect(page).toHaveTitle('Todos');
  await page.getByRole('textbox', { name: 'Title' }).fill('Buy milk');
  await page.getByRole('button', { name: 'Add' }).click();
  await expect(page.getByRole('listitem')).toHaveText('Buy milk');
  await expect(page.getByRole('listitem')).toHaveClass('todo open');
  await expect(page.getByRole('listitem')).toHaveCount(1);
  await expect(page.getByRole('textbox')).toHaveValue('');
  await expect(page.getByRole('button')).toBeEnabled();
  await expect(page.getByText('Nothing')).not.toBeVisible();
});

test('fails with what the page showed', async ({ page }) => {
  await page.setContent(HTML);
  await page.getByRole('textbox', { name: 'Title' }).fill('Walk');
  await page.getByRole('button', { name: 'Add' }).click();
  await expect(page.getByRole('listitem')).toHaveText(process.env.BREAK_WEB ? 'Run' : 'Walk', { timeout: 1000 });
});
