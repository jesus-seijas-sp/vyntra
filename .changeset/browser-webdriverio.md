---
"vyntra": minor
"@vyntra/web": minor
---

The WebdriverIO provider of browser mode: `provider: 'webdriverio'`, or vitest 4's `webdriverio()` (whose package, like `@vitest/browser-playwright`'s, a config can import without it installed), runs test files in Chrome, Firefox, Edge or Safari through WebDriver, with the same `page`, `userEvent`, locators, mocks and snapshots. Pages now talk to the runner through its local server for both providers. The factory's options go to WebdriverIO's `remote()`.

Safari runs one session at a time, so its test files run one after the other; full-page screenshots, which need WebDriver BiDi, say so where a session lacks it.
