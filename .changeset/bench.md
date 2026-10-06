---
"vyntra": minor
---

Benchmarks: `vyntra bench` runs the `*.bench.*` files (Vitest's `benchmark` options too) one at a time. `bench(name, fn, { time, iterations, warmupTime, warmupIterations, setup, teardown })` measures as tinybench does; each group prints hz, min, max, mean, p75 to p999, margin of error and samples, the summary the fastest of each group. `--outputJson` saves the results and `--compare` shows the change against them.
