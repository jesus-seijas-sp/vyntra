---
"vyntra": minor
---

Every run writes `.vyntra/report.json` (`outputDir` moves it, `false` turns it off), and `--last-failed` reruns only the tests that failed, and the files that did not load, until they pass. A run that leaves a failure out (a path, `-t`, `--shard`) keeps it for the next `--last-failed`.
