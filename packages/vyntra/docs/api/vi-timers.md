# Fake timers

| Function | What it does |
| --- | --- |
| `vi.useFakeTimers({ now, toFake, doNotFake, loopLimit })` | Fakes `setTimeout`, `setInterval`, `setImmediate` (and their clear functions), `Date` and `performance.now`. `queueMicrotask` and `nextTick` when listed in `toFake` |
| `vi.useRealTimers()` | The real ones again (also when the file ends) |
| `vi.advanceTimersByTime(ms)`, `vi.advanceTimersByTimeAsync(ms)` | Moves the clock, running the timers due |
| `vi.advanceTimersToNextTimer(steps?)` (and `Async`) | Runs the next timers |
| `vi.runAllTimers()` (and `Async`) | Runs every timer, and the ones they add |
| `vi.runOnlyPendingTimers()` (and `Async`) | Runs the timers pending now |
| `vi.setSystemTime(date)`, `vi.getMockedSystemTime()`, `vi.getRealSystemTime()` | The time of the fake clock, and the real one |
| `vi.getTimerCount()`, `vi.clearAllTimers()`, `vi.isFakeTimers()` | The pending timers |
