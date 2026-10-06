# Not supported yet

- **Watch mode.** `--watch` is accepted and runs the tests once.
- **Test environments of your own** (a Jest `testEnvironment` module), and `testEnvironmentOptions`.
- **Babel run implicitly**, as Jest does when it finds a Babel config: name `babel-jest` in `transform`.
- **Asynchronous transformers** (a Jest transformer with only `processAsync`), and Vite plugins' `resolveId` and `load` hooks.
- **Named imports from JSON** and `import.meta.env`, which Vite provides.
- **Type checking** (Vitest's `typecheck`), browser mode, `bench`, and in-source tests.
- **The coverage of files no test loads.**

If your suite needs one of them, keep your current runner for now, or run the tests that need it with it.
