# Projects

A project is a part of the suite with options of its own: its files, environment, setup files, timeouts, workers. One run runs them all, and reports them together, each file under its project's name.

```js
// vyntra.config.js
module.exports = {
  setupFiles: ['./test/setup.js'], // every project's, unless one sets its own
  projects: [
    { name: 'unit', include: ['src/**/*.test.ts'], environment: 'happy-dom' },
    {
      name: 'api',
      include: ['test/api/**/*.test.ts'],
      globalSetup: './test/api/seed.ts',
      use: { baseURL: 'http://localhost:4000' },
      dependsOn: ['unit'],
    },
  ],
};
```

A project takes the options of the top level and changes those it sets; `use` is merged. A file belongs to the first project that includes it. Options of the whole run (reporters, coverage, `--shard`, `bail`) stay at the top level. `--project api` runs only that project (repeat it, or use commas), and a file stays in its project whichever are run.

Each project has its own workers, which share the machine: the top-level `maxWorkers` (the cores less one) is shared out between the projects running at once, in proportion to their work, and a project's own `maxWorkers` keeps it below that. A project waits for those in its `dependsOn` and is skipped when one of them fails; projects that depend on nothing run together. A project left out of the run (by `--project`) is not waited for.

## Global setup

`globalSetup` files run once, in the main process: at the top level around the whole run, in a project around its files. As in Jest and Vitest, a file exports its setup function (or `setup`), which may return its teardown; `teardown` exports and `globalTeardown` files run after. What it hands to `provide(key, value)`, or returns as an object, the tests read with `inject(key)`:

```js
// test/api/seed.ts
export default async function setup({ provide }) {
  const db = await startDatabase();
  provide('databaseUrl', db.url);
  return () => db.stop();
}

// test/api/users.test.ts
import { inject } from 'vyntra';
const url = inject('databaseUrl');
```

A setup that throws is reported against its file, as a broken setup (exit code 2), and its project's tests do not run.

## A server for the tests

`server` starts a command before the tests (of the run, or of a project), waits until its `url` answers, and stops it after them, with whatever it started:

```js
server: {
  command: 'npm run start:test',
  url: 'http://localhost:4000/health', // or port: 4000
  timeout: 60_000, // how long it may take to answer (the default)
  reuseExisting: !process.env.CI, // attach to one already running, locally
  env: { DATABASE_URL: 'postgres://localhost/test' },
},
```

It is up when it answers with a success, a redirect, or 400 to 403, as in Playwright. One that exits first, or does not answer in time, fails the run as a problem of the environment (exit code 3), with what it printed. Without `reuseExisting`, finding something already answering at the url is an error, so a test never runs against a stale server by mistake. A test reaches it through the `server` fixture, `{ url, name, reused }`, and the failure pages of a file that failed end with the last lines the server printed.
