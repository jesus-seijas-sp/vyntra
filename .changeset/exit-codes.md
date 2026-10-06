---
"vyntra": minor
---

Exit codes tell a broken test from a broken setup: `1` a test failed, `2` the config or a test file did not load, no test files were found, or an `.only` with `allowOnly: false`; `4` an error of vyntra itself; `130` interrupted, which now stops the running workers.
