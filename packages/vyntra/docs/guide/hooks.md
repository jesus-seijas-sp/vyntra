# Hooks

`beforeAll` and `afterAll` run once around the tests of their `describe` (or of the file, at the top level); `beforeEach` and `afterEach` around every test. They run in Jest's order: the `beforeEach` hooks from the outside in, the `afterEach` hooks from the inside out.

```js
let db;

beforeAll(async () => {
  db = await connect();
});

afterAll(() => db.close());

beforeEach(async () => {
  await db.seed();
  // A function returned by beforeEach runs after the test, as in Vitest.
  return () => db.clear();
});
```

When a `beforeAll` fails, the tests of its suite are reported as failed with its error, and its `afterAll` still runs.
