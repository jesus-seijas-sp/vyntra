---
"vyntra": minor
"@vyntra/web": minor
---

Browser mode: a project with Vitest's `browser.enabled` runs its test files in real browser pages, through `@vyntra/web` on Playwright. Each file is bundled with the project's esbuild together with vyntra's runtime for pages, and served to a page of its own. `vitest/browser` gives `page` (locators, viewport, screenshot) and `userEvent`, whose actions Playwright performs; `expect.element` retries, jest-dom's matchers are there, and `vi.mock` works with factories (async, with `importOriginal`) or as automocks. Failures and console output point at the test's files.
