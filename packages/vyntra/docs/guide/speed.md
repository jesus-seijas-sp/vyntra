# Why it is fast

Measured on real suites, most of a test run is not the tests. vyntra removes what it can of the rest:

- **No transform pipeline.** Files are loaded by Node.js as they are, instead of going through Babel or Vite first.
- **Warm workers.** Dependencies are loaded once per worker, not once per file.
- **Caches between runs**, in `node_modules/.cache/vyntra`: the duration of every file, where `require()` found each dependency (resolving a large dependency tree probes the file system thousands of times), and what was compiled (TypeScript, JSX, your Jest `transform`). V8's own code cache is off unless `compileCache: true`: it grew without being read back.
- **The slowest file first**, on just enough workers.
- **Assertions that cost nothing when they pass.** Messages, diffs and code frames are only built for failures.

The [benchmarks](benchmarks.html) show where the time goes, runner by runner.
