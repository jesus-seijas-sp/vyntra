# Mock function methods

| Method or property | What it does |
| --- | --- |
| `mock.calls`, `mock.results`, `mock.instances`, `mock.contexts`, `mock.lastCall`, `mock.settledResults`, `mock.invocationCallOrder` | What the mock recorded |
| `mockImplementation(fn)`, `mockImplementationOnce(fn)` | What it does, always / on the next call |
| `mockReturnValue(v)`, `mockReturnValueOnce(v)` | What it returns |
| `mockResolvedValue(v)`, `mockResolvedValueOnce(v)` | A promise that resolves to `v` |
| `mockRejectedValue(e)`, `mockRejectedValueOnce(e)` | A promise that rejects with `e` |
| `mockReturnThis()` | Returns `this` |
| `withImplementation(fn, callback)` | Uses `fn` while `callback` runs |
| `mockClear()`, `mockReset()`, `mockRestore()` | As `vi.clearAllMocks`... for this mock |
| `mockName(name)`, `getMockName()`, `getMockImplementation()` | Its name, and its implementation |
