---
"vyntra": minor
---

Type tests: `--typecheck` (or Vitest's `typecheck.enabled`) checks the `*.test-d.ts` files with the project's `tsc` (or `vue-tsc`), as Vitest does: each type error fails the test it is in, errors outside tests fail the file, and errors in source files fail the run unless `ignoreSourceErrors`. `--typecheck.only` runs nothing else. `expectTypeOf` and `assertType` are no-ops at run time.
