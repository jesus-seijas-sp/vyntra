# Browser mode

With Vitest's `browser.enabled`, a project's test files run in a real browser page, as under `vitest`: real layout, real events, the browser's own APIs. vyntra does it with `@vyntra/web` on Playwright, and with the esbuild your Vite project has: each test file is bundled, its packages with it, and run in a page of its own, several at once.

```sh
npm install --save-dev @vyntra/web playwright
npx playwright install chromium
```

```js
// vitest.config.ts
export default {
  test: { browser: { enabled: true, provider: 'playwright', instances: [{ browser: 'chromium' }] } },
};

// Counter.test.jsx
import { render } from '@testing-library/react';
import { page, userEvent } from 'vitest/browser';

test('counts clicks', async () => {
  render(<Counter />);
  await userEvent.click(page.getByRole('button', { name: 'Increment' }));
  await expect.element(page.getByRole('status')).toHaveTextContent('Count: 1');
});
```

`vitest/browser` (or `@vitest/browser/context`) gives `page` (`getByRole`, `getByText`, `getByLabelText`, `getByPlaceholder`, `getByAltText`, `getByTitle`, `getByTestId`, `viewport`, `screenshot`) and `userEvent` (`click`, `dblClick`, `fill`, `type`, `clear`, `hover`, `selectOptions`, `keyboard`, `tab`), whose actions Playwright performs. `expect.element()` retries for a second, and jest-dom's matchers are there (`toBeVisible`, `toHaveTextContent`, `toHaveValue`...). `vi.mock` works with a factory (async, with `importOriginal`) or without one. Snapshots work as in Node: `toMatchSnapshot` and `toMatchInlineSnapshot`, with `-u`, elements printed as Vitest prints them. Stylesheets are added to the page, images are data URLs, and failures and console output point at your files.

Not yet in browser mode: coverage, and the WebdriverIO provider.
