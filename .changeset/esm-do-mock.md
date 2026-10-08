---
"vyntra": patch
---

`vi.doMock()` and the ES modules a test imports: the mocks of a CommonJS test file reach the imports of the ES modules it `import()`s (and those modules are fresh after `vi.resetModules()`, as in an ES module test file); a module resolved before it was mocked gets its mock; an async factory (`importOriginal`) settles before the `import()` after it, as in Vitest (the `import()`s of a file that calls `vi.doMock()` wait for the factories); and `importOriginal()` of a builtin gives the builtin.
