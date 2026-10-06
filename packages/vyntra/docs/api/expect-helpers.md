# expect helpers

| Function | What it does |
| --- | --- |
| `expect.soft(value)` | Matchers that record the failure and let the test go on |
| `expect.poll(fn, { timeout, interval })` | Matchers that retry on `fn()` until they pass (1 s, every 50 ms by default) |
| `expect.assertions(n)` | Fails the test unless `n` assertions ran |
| `expect.hasAssertions()` | Fails the test unless an assertion ran |
| `expect.extend(matchers)` | Adds matchers, and their asymmetric forms `expect.name()`, `expect.not.name()` |
| `expect.addEqualityTesters(testers)` | Adds equality rules for your types |
| `expect.addSnapshotSerializer(serializer)` | Adds a pretty-format plugin for snapshots |
| `expect.getState()` | The assertion count, the name and path of the current test, and `snapshotState._updateSnapshot` (`'all'` under `-u`, `'none'` under `--ci`, `'new'` otherwise), which some tests read to regenerate their fixtures |
| `expect.unreachable(message?)` | Fails: for code that should not run |
