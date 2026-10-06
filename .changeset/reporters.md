---
"vyntra": minor
---

`--reporter` takes a list (repeated, or names with commas), and three reporters write the run next to what is printed: `junit` (`.vyntra/junit.xml`), `markdown` (`.vyntra/summary.md` and a page per failed or flaky test with the error, its source line, every attempt, the console output and a rerun command) and `github` (annotations on the failing lines and the job summary; on by itself under GitHub Actions when no reporter is configured). Vitest's `reporters` are read from its config.
