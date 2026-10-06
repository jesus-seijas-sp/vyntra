---
"vyntra": minor
---

Test environments of your own: `environment` (Vitest) or `testEnvironment` (Jest), and a file's `@vitest-environment` / `@jest-environment` comment, can name one by path or package. A Vitest environment's `setup(global, options)` and a Jest environment class (over `NodeEnvironment` or `JSDOMEnvironment`, with `testEnvironmentOptions`) are set up for each of their files and torn down after.
