# End-to-end tests

A project with `engine: 'web'` runs its tests in a browser, with [`@vyntra/web`](https://www.npmjs.com/package/@vyntra/web) on Playwright. Tests destructure `page` (or `context`, `browser`) and check it with assertions that retry until the page agrees:

```sh
npm install --save-dev @vyntra/web playwright
npx playwright install chromium
```

```js
// vyntra.config.js
{ name: 'e2e', include: ['e2e/**/*.e2e.ts'], engine: 'web', dependsOn: ['api'] }

// e2e/todos.e2e.ts
test('adds a todo', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('textbox', { name: 'New todo' }).fill('Buy milk');
  await page.getByRole('button', { name: 'Add' }).click();
  await expect(page.getByRole('listitem')).toHaveText('Buy milk');
});
```

Each test gets a fresh context and page; the browser is set up once per worker. The project's `use` sets `baseURL`, `browserName`, `viewport`, `trace` and `screenshot`. A web project runs in child processes on half the cores, retries a failing test once, and gives tests 30 seconds, unless it says otherwise.

When a test fails, its page in the `markdown` report shows a screenshot, the page's URL and accessibility tree, its console and network, and the Playwright trace with the command that opens it, for every attempt: what a person, or a coding agent, needs to see what went wrong without running it again.
