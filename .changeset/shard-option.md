---
"vyntra": minor
---

Add `--shard <index>/<total>` (and the `shard` option) to run one slice of the test files, for CI jobs in parallel. Files are split by size, so every machine computes the same slices.
