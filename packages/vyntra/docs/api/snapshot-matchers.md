# Snapshot matchers

| Matcher | What it does |
| --- | --- |
| `toMatchSnapshot(properties?, hint?)` | Compares with the snapshot in `__snapshots__/<file>.snap`, writing it the first time. `properties` are matchers for the values that change on every run |
| `toMatchInlineSnapshot(properties?, snapshot?)` | The same, with the snapshot written into the test |
| `toThrowErrorMatchingSnapshot(hint?)` | Compares the message of the error thrown with a snapshot |
| `toThrowErrorMatchingInlineSnapshot(snapshot?)` | The same, inline |

Line endings of the values are written as `\n`, so a snapshot taken on Windows matches on Linux and the other way around.
