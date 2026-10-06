# From Vitest

Your test files run as they are, imports from `vitest` included:

```js
import { describe, expect, it, vi } from 'vitest'; // resolved to vyntra
```

- `vi.fn`, `vi.spyOn`, `vi.mock` with `importOriginal`, `vi.hoisted`, `vi.doMock`, `vi.importActual`, fake timers, `vi.stubGlobal`, `vi.stubEnv`, `vi.waitFor`.
- `test.extend` fixtures, `test.for`, `test.concurrent`, `test.fails`, `skipIf` and `runIf`, the test context.
- `expect.soft`, `expect.poll`, `toBeTypeOf`, `toBeOneOf`, `toSatisfy`, `toHaveBeenCalledOnce`...
- Your `.snap` files, read and written in Vitest's format (`describe > test 1` names).

## Vitest options

vyntra reads your `vitest.config.ts` (or a `vite.config.*` with a `test` section) without loading Vite: `defineConfig`, `mergeConfig` and `configDefaults` from `vitest/config` work even once Vitest is uninstalled. Of its options it takes:

| Vitest (`test.*`) | vyntra |
| --- | --- |
| `include`, `exclude`, `setupFiles` | ✓ The same |
| `testTimeout`, `hookTimeout`, `retry`, `maxConcurrency` | ✓ The same |
| `pool`, `isolate`, `maxWorkers` | ✓ `'threads'`, `'forks'` or `'inline'` |
| `clearMocks`, `mockReset`, `restoreMocks` | ✓ `clearMocks`, `resetMocks`, `restoreMocks` |
| `unstubGlobals`, `unstubEnvs` | ✓ Always, when a file ends |
| `globals` | ✓ Always on; imports work as well |
| `coverage.include`, `coverage.thresholds` | ✓ `collectCoverageFrom`, `coverageThreshold` |
| `environment: 'jsdom'`, `'happy-dom'`, `environmentOptions` | ✓ With the jsdom or happy-dom your project has; a file can ask for its own with a `@vitest-environment` comment |
| `test.alias`, `resolve.alias`, `test.env` | ✓ The same |
| `import.meta.env`, `envDir`, `envPrefix`, named JSON imports | ✓ As Vite provides them: Vite's values and the `VITE_` variables of `.env` files, over `process.env` (see [What files can import](../guide/imports.md)) |
| Oxc's `decorator` and esbuild's `tsconfigRaw` options | ✓ For the TypeScript transform |
| Vite plugins | ✓ Their `transform`, `resolveId` and `load` hooks, async ones too, on every project file; virtual modules work. Plugins with only synchronous transforms run in the worker; the others on a helper thread the module hooks wait for |
| `globalSetup` | ✓ Its `provide()` and the tests' `inject()` too |
| `test.projects`, `vitest.workspace` | ✓ Each project from its own folder: folders (with their own config or none), config files, or projects written inline, which take the root config's options with `extends: true`. Named by `test.name`, or their `package.json`. See [Projects](../guide/projects.md) |
| `typecheck`, `expectTypeOf`, `assertType` | ✓ `--typecheck` checks the `*.test-d.ts` files with your `tsc` (or `vue-tsc`), each error on its test; `include`, `tsconfig`, `checker`, `ignoreSourceErrors` as in Vitest. At run time `expectTypeOf` and `assertType` do nothing |
| `includeSource`, in-source tests (`if (import.meta.vitest)`) | ✓ The same: a source file is a test file when it has them, and a module another test imports keeps them to itself |
| `bench`, `vitest bench`, `benchmark` options | ✓ `vyntra bench` runs the `*.bench.*` files: `bench(name, fn, { time, iterations, warmupTime, warmupIterations, setup, teardown })`, tables of hz, percentiles and margin of error, `--outputJson` and `--compare` |
| Browser mode | ✗ Not supported: [`@vyntra/web`](../guide/e2e.md) runs tests in a browser with Playwright |

## Differences with Vitest

- **The order of `afterEach` and `afterAll` hooks** follows the config: in reverse, as Vitest runs them, with a Vitest config or none; in the order they were declared, as Jest runs them, with a Jest config (or `hookOrder: 'list'`).
- **Globals are always there.** A test that checks that `describe` is not a global would notice; nothing else does.
- **Only what Node.js can not run is compiled**: JSX and TypeScript-only syntax (decorators, `enum`), with the esbuild, sucrase or TypeScript your project has.
- **JSON is imported as a default export only.** `import data from './data.json'` works without `with { type: 'json' }`, as in Vitest, but the named imports Vite adds (`import { version } from './package.json'`) do not.
- **`NODE_ENV` is left as it is.** Vitest sets it to `test` when it is not set; vyntra does not (see [the differences with Jest](jest.md)).
