# Test context and fixtures

Every test gets a context object, as in Vitest: its `task` (name, file), an `expect` of its own, `skip()`, `signal` (aborted when the test ends), and `onTestFinished` / `onTestFailed` to register clean-ups.

```js
test('writes a temporary file', ({ task, onTestFinished, skip }) => {
  skip(!process.env.TMPDIR, 'needs TMPDIR');
  const file = createTempFile(task.name);
  onTestFinished(() => removeFile(file));
});
```

`test.extend` declares fixtures: values, or functions that set something up, hand it to the test with `use()` and tear it down after. A test only sets up the fixtures it destructures.

```js
const dbTest = test.extend({
  db: async ({}, use) => {
    const db = await connect();
    await use(db);
    await db.close();
  },
  user: async ({ db }, use) => {
    await use(await db.users.insert({ name: 'Ann' }));
  },
});

dbTest('finds the user', async ({ db, user }) => {
  expect(await db.users.find(user.id)).toEqual(user);
});
```

## Shared fixtures and options

A fixture is set up for each test that uses it, unless its `scope` says otherwise: `'file'` sets it up once for the tests of a file, and `'worker'` once per worker, for every file it runs, torn down when the worker ends. Something slow to start (a browser, a database) goes there. A shared fixture destructures what it uses, as test fixtures do, and can only use fixtures that live as long as it does. One whose setup throws fails every test that uses it, at once, with that error.

```js
const test = base.extend({
  // An option: this default, or the config's use.baseURL.
  baseURL: ['http://localhost:3000', { option: true }],
  db: [
    async ({ baseURL }, use) => {
      const db = await startDatabase(baseURL);
      await use(db);
      await db.stop();
    },
    { scope: 'worker' },
  ],
});
```

The config's `use` gives fixtures their options, and every value in it is a fixture any test can destructure, without `test.extend`: `use: { baseURL: 'http://localhost:4000' }`.
