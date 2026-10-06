const { randomUUID } = require('node:crypto');
const { test: base, expect } = require('vyntra');

// The app on a list of its own, so tests can run at once.
const test = base.extend({
  app: async ({ page }, use) => {
    await page.goto(`/?list=${randomUUID()}`);
    await expect(page.getByRole('status')).toHaveText('Nothing to do');
    await use(page);
  },
});

// Adds a todo through the form, and waits for the form to take it.
const add = async (page, title) => {
  const input = page.getByRole('textbox', { name: 'New todo' });
  await input.fill(title);
  await page.getByRole('button', { name: 'Add' }).click();
  if (title.trim()) {
    await expect(input).toHaveValue('');
  }
};

test('adds todos and counts what is left', async ({ app }) => {
  await add(app, 'Buy milk');
  await add(app, 'Walk the dog');
  await expect(app.getByRole('listitem').locator('label')).toHaveText(['Buy milk', 'Walk the dog']);
  await expect(app.getByRole('status')).toHaveText('2 of 2 left');
});

test('completes a todo', async ({ app }) => {
  await add(app, 'Buy milk');
  await app.getByRole('checkbox').check();
  await expect(app.getByRole('listitem')).toHaveClass('todo done');
  await expect(app.getByRole('status')).toHaveText('0 of 1 left');
});

test('deletes a todo', async ({ app }) => {
  await add(app, 'Buy milk');
  await app.getByRole('button', { name: 'Delete Buy milk' }).click();
  await expect(app.getByRole('listitem')).toHaveCount(0);
  await expect(app.getByRole('status')).toHaveText('Nothing to do');
});

test('says why a todo can not be added', async ({ app }) => {
  await add(app, '   ');
  await expect(app.getByRole('alert')).toHaveText('A todo needs a title');
  await expect(app.getByRole('listitem')).toHaveCount(0);
});

test('keeps the todos when the page reloads', async ({ app }) => {
  await add(app, 'Buy milk');
  await expect(app.getByRole('listitem')).toHaveCount(1);
  await app.reload();
  await expect(app.getByRole('listitem')).toContainText('Buy milk');
});
