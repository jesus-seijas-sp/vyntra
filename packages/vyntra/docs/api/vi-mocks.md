# Mocks and spies

| Function | What it does |
| --- | --- |
| `vi.fn(implementation?)` | A mock function |
| `vi.spyOn(object, method, accessType?)` | Replaces a method (or a `'get'` / `'set'` accessor) with a mock that calls the original. With `'get'` or `'set'`, a plain property works too: it becomes an accessor that reads and writes its value |
| `vi.isMockFunction(value)` | Whether a value is a mock |
| `vi.mocked(value)` | Returns the value (for TypeScript) |
| `vi.clearAllMocks()` | Forgets the calls of every mock |
| `vi.resetAllMocks()` | Also puts back their first implementation |
| `vi.restoreAllMocks()` | Puts back what the spies replaced |
