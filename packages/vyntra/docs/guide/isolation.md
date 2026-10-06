# Workers and isolation

vyntra runs the files in parallel, in worker threads that stay alive between files. Each file gets fresh copies of your own modules (what it changes in them does not reach the next file), while `node_modules` stays loaded, which is where most of the loading time is.

- **How many workers:** after the first run, vyntra knows how long each file takes. It starts the slowest first, and uses just enough workers for the slowest file to be the whole run: more would only add startup time and compete for the cores. `-w` sets the number.
- **`--pool forks`** runs the files in child processes, as Jest does, for code that needs a process of its own: `process.chdir`, native addons that are not thread safe.
- **`-i`** runs everything in the main thread: the fastest for a few small files, and the easiest to debug.
- **`--no-isolate`** shares your modules between the files of a worker: faster still, for suites whose files do not change shared state.

## What is restored between files

Jest gives every test file a process of its own (with its own global object), and Vitest a worker. vyntra runs many files in the same worker, so it puts back what a file changed before the next one starts:

- **`process.env`:** the variables a file sets, changes or deletes are as they were.
- **Globals:** what a file adds to the global object is removed, even when it was defined as not configurable (`Object.defineProperty(global, 'app', { get })`), and what it replaced comes back.
- **Mocks and modules:** spies are restored and module mocks forgotten. A file that mocked something leaves no module behind that was built with the mocks: the dependencies loaded after its first mock are loaded again for the next file (all of them, when it mocked a builtin such as `fs`).
- **Timers:** fake timers are uninstalled, and `vi.stubGlobal` and `vi.stubEnv` undone.

Some things a process does are kept from ending the worker: `process.kill(process.pid, 'SIGTERM')` reaches the file's `SIGTERM` listeners (it ends only that worker when there are none), `process.send` exists (and does nothing), and child processes started with `stdio: [process.stdin, process.stdout, process.stderr]` get what a worker thread can give them instead of failing. A promise rejected without a handler that gets one later (a rejection awaited with `.rejects` after advancing fake timers) is not a failure, as in Jest.

## Splitting long files

A run is never shorter than its slowest file. When that file's tests do not depend on each other (each one sets up what it needs), vyntra can run it in parts on several workers: every part loads the file, runs its hooks and one test of every few, and the results come back as one file. Allow it for those files:

```js
// vyntra.config.js
module.exports = {
  splitFiles: ['test/e2e/**'], // or true, for every file
};
```

vyntra splits a file only when it is one of the long ones and when splitting pays: a part repeats the file's setup (its `beforeAll`, the servers it starts), so files that spend most of their time in setup stay whole. It also leaves cores free, as tests that start servers of their own compete for them.
