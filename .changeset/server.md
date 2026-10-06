---
"vyntra": minor
---

The `server` option starts a command before the tests of the run or of a project, waits until its `url` (or `port`) answers, and stops it, and what it started, after them; `reuseExisting` attaches to one already running. A server that does not come up fails the run with exit code 3 and its output. Tests reach it through the `server` fixture, and failure pages end with what it printed.
