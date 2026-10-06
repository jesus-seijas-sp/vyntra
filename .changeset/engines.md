---
"vyntra": minor
---

Engines: a project's `engine` (`'web'` is `@vyntra/web`) adds its fixtures and matchers, and its defaults under the options the project sets. Fixtures get `testInfo` (`failed` before they tear down, `outputPath()`, `attach()`), and what they attach to a failed or flaky attempt is shown on its failure page, from `.vyntra/artifacts/`.
