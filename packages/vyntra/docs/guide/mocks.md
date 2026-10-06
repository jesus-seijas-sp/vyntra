# Mock functions

`vi.fn()` (the same as `jest.fn()`) makes a function that records its calls. Its implementation can be set, for every call or for the next ones:

```js
const send = vi.fn().mockResolvedValue({ ok: true });

await notify(send, 'ann@example.com');

expect(send).toHaveBeenCalledTimes(1);
expect(send).toHaveBeenCalledWith('ann@example.com', expect.any(String));
expect(send.mock.calls[0][0]).toBe('ann@example.com');
```

`vi.spyOn(object, 'method')` replaces a method with a mock that calls the original, until it is restored:

```js
const spy = vi.spyOn(Math, 'random').mockReturnValue(0.5);
expect(roll()).toBe(4);
spy.mockRestore();
```

`vi.clearAllMocks()` forgets the calls of every mock, `vi.resetAllMocks()` also their implementations, `vi.restoreAllMocks()` puts back what spies replaced. The options `clearMocks`, `resetMocks` and `restoreMocks` do it before every test. Spies are always restored when a file ends. `vi.stubGlobal` and `vi.stubEnv` replace a global or an environment variable until the file ends.
