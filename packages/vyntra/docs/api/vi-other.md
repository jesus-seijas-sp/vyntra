# Stubs and waiting

| Function | What it does |
| --- | --- |
| `vi.stubGlobal(name, value)`, `vi.unstubAllGlobals()` | Replaces a global, until the file ends |
| `inject(key)` | A value a `globalSetup` provided (see [Global setup](../guide/projects.md)); imported from `vyntra` or `vitest` |
| `vi.stubEnv(name, value)`, `vi.unstubAllEnvs()` | Replaces an environment variable, until the file ends |
| `vi.waitFor(fn, { timeout, interval })` | Retries `fn` until it does not throw |
| `vi.waitUntil(fn, { timeout, interval })` | Retries `fn` until it returns something truthy |
| `vi.setConfig({ testTimeout })`, `jest.setTimeout(ms)` | The timeout of the next tests |
| `jest.retryTimes(n)` | Retries failing tests `n` times |
