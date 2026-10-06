# Fake timers

`vi.useFakeTimers()` replaces `setTimeout`, `setInterval`, `setImmediate`, `Date` and `performance.now` by a clock that only moves when the test moves it:

```js
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

test('retries after a second', () => {
  const retry = vi.fn();
  scheduleRetry(retry);
  vi.advanceTimersByTime(999);
  expect(retry).not.toHaveBeenCalled();
  vi.advanceTimersByTime(1);
  expect(retry).toHaveBeenCalled();
});

test('uses today', () => {
  vi.setSystemTime(new Date('2030-01-01'));
  expect(today()).toBe('2030-01-01');
});
```

The `Async` variants (`advanceTimersByTimeAsync`, `runAllTimersAsync`...) let pending promises settle between one timer and the next. vyntra's own timeouts always use the real clock.
