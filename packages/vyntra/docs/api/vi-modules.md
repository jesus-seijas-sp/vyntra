# Module mocks

| Function | What it does |
| --- | --- |
| `vi.mock(path, factory?)` | Replaces a module for the file; moved to the top of the file. Without a factory: `__mocks__`, or automock. `vi.mock(path, { spy: true })` automocks with spies that call the originals. Builtins (`vi.mock('fs')`, `'node:fs'`) and packages can be mocked too |
| `jest.mock(path, factory?, { virtual })` | The same; `virtual` for modules that do not exist |
| `vi.doMock(path, factory?)` | As `vi.mock`, from where it is called |
| `vi.unmock(path)`, `vi.doUnmock(path)` | The real module again |
| `jest.dontMock(path)`, `jest.deepUnmock(path)` | Jest's names for `doUnmock` and `unmock` |
| `vi.hoisted(fn)` | Runs `fn` before the mocks, for values their factories use |
| `vi.importActual(path)`, `jest.requireActual(path)` | The real module |
| `vi.importMock(path)`, `jest.requireMock(path)` | The mocked module |
| `vi.resetModules()` | Loads the project modules again on their next import |
| `jest.isolateModules(fn)` | The modules `fn` loads are its own |
