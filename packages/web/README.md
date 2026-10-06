# @vyntra/web

End-to-end web tests for [vyntra](https://www.npmjs.com/package/vyntra), on Playwright: a project with
`engine: 'web'` gets a browser, a fresh context and page for each test, web-first assertions, and failure
pages that show what the page did.

```sh
npm install --save-dev vyntra @vyntra/web playwright
npx playwright install chromium
```

```js
// vyntra.config.js
module.exports = {
  server: { command: 'npm start', url: 'http://localhost:3000/health' },
  use: { baseURL: 'http://localhost:3000' },
  projects: [
    { name: 'unit', include: ['src/**/*.test.ts'] },
    { name: 'e2e', include: ['e2e/**/*.e2e.ts'], engine: 'web' },
  ],
};
```

```js
// e2e/todos.e2e.ts
test('adds a todo', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('textbox', { name: 'New todo' }).fill('Buy milk');
  await page.getByRole('button', { name: 'Add' }).click();
  await expect(page.getByRole('listitem')).toHaveText('Buy milk');
});
```

## Fixtures

| Fixture | Scope | What it is |
| --- | --- | --- |
| `browser` | worker | A Playwright browser, launched once per worker |
| `context` | test | A fresh browser context (`baseURL` from `use`), traced when `use.trace` says so |
| `page` | test | A page of that context, whose console and network are kept |

Options, in `use`: `browserName` (`chromium`, `firefox`, `webkit`), `headless`, `launchOptions`,
`viewport`, `contextOptions`, `trace` (`on-failure`, the default; `on`; `off`), `screenshot`
(`only-on-failure`, the default; `on`; `off`).

## Assertions

They retry until the page agrees, for up to 5 seconds (`{ timeout }` changes it), and `.not` waits for the
opposite: `toBeVisible`, `toBeHidden`, `toBeEnabled`, `toBeDisabled`, `toBeChecked`, `toBeEditable`,
`toBeFocused`, `toBeAttached`, `toHaveCount`, `toHaveText` (a text, a RegExp, or a list for several
elements), `toContainText`, `toHaveValue`, `toHaveAttribute`, `toHaveClass` on locators; `toHaveURL` and
`toHaveTitle` on pages.

## When a test fails

Its page in the `markdown` report (`--reporter default,markdown`) shows a screenshot, the URL, the page's
accessibility tree, its console and network, and the Playwright trace with the command that opens it, for
every attempt. The files are in `.vyntra/artifacts/`.

## Defaults

A web project runs in child processes (`pool: 'forks'`) on half the cores, retries a failing test once
(and reports it as flaky if it then passes), and gives tests and hooks 30 seconds. Set any of them in the
project to change it.

## License

MIT
