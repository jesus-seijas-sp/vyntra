---
"vyntra": minor
---

In-source tests: with `includeSource` (read from Vitest configs too), source files that hold tests in an `if (import.meta.vitest)` block run as test files. `import.meta.vitest` is the test API in the file being run and `undefined` in the modules it imports, as in Vitest.
