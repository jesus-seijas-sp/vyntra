# Not supported yet

- **Test environments of your own** (a Jest `testEnvironment` module), and `testEnvironmentOptions`.
- **Babel run implicitly**, as Jest does when it finds a Babel config: name `babel-jest` in `transform`.
- **Asynchronous transformers** (a Jest transformer with only `processAsync`), and Vite plugins' `resolveId` and `load` hooks.
- **Type checking** (Vitest's `typecheck`), browser mode, `bench`, and in-source tests.

If your suite needs one of them, keep your current runner for now, or run the tests that need it with it.
