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
| Oxc's `decorator` and esbuild's `tsconfigRaw` options | ✓ For the TypeScript transform |
| Vite plugins | ✓ Their synchronous `transform` hooks; no `resolveId` |
| `globalSetup` | ✓ Its `provide()` and the tests' `inject()` too |
| `projects` (and workspaces) | ✗ Not read from a vitest config (vyntra warns): write them as [vyntra projects](../guide/projects.md), or run vyntra in each project's directory |
| Vite plugins' `resolveId` and `load`, async `transform` hooks | ✗ Not run: vyntra's module hooks are synchronous |
| Browser mode, `typecheck`, `bench`, in-source tests | ✗ Not supported |

## Differences with Vitest

- **The order of `afterEach` and `afterAll` hooks** follows the config: in reverse, as Vitest runs them, with a Vitest config or none; in the order they were declared, as Jest runs them, with a Jest config (or `hookOrder: 'list'`).
- **Globals are always there.** A test that checks that `describe` is not a global would notice; nothing else does.
- **Only what Node.js can not run is compiled**: JSX and TypeScript-only syntax (decorators, `enum`), with the esbuild, sucrase or TypeScript your project has. `import.meta.env` is not defined.
- **JSON is imported as a default export only.** `import data from './data.json'` works without `with { type: 'json' }`, as in Vitest, but the named imports Vite adds (`import { version } from './package.json'`) do not.
- **`NODE_ENV` is left as it is.** Vitest sets it to `test` when it is not set; vyntra does not (see [the differences with Jest](jest.md)).
