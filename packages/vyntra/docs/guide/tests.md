# Tests and suites

`test` (or `it`) declares a test; `describe` groups tests, and its name is part of theirs. Modifiers change how they run:

```js
describe('orders', () => {
  test('are created', () => {});
  test.skip('are archived', () => {});       // not run
  test.todo('are refunded');                 // a reminder
  test.only('are paid', () => {});           // only the .only tests of the file run
  test.fails('reject a negative total', () => {
    expect(-1).toBeGreaterThan(0);           // passes because it fails
  });
  test.skipIf(process.platform === 'win32')('use symlinks', () => {});
  test.runIf(process.env.CI)('run on CI only', () => {});
});

describe.skip('invoices', () => {});         // every test inside is skipped
```

## One test per case

`test.each` declares a test for every case of a table. The name takes the values with `printf`-style placeholders (`%s`, `%d`, `%i`, `%f`, `%j`, `%o`, `%p`, `%#` for the index), or with `$name` for the keys of object cases:

```js
test.each([
  [1, 1, 2],
  [2, 3, 5],
])('%i + %i = %i', (a, b, expected) => {
  expect(a + b).toBe(expected);
});

test.each([{ name: 'Ann', age: 30 }])('$name is $age', ({ age }) => {
  expect(age).toBeGreaterThan(18);
});

test.each`
  a    | b    | sum
  ${1} | ${1} | ${2}
`('$a + $b = $sum', ({ a, b, sum }) => {
  expect(a + b).toBe(sum);
});
```

`describe.each` does the same with suites. `test.for` is Vitest's variant: the case is given as it is (not spread), followed by the test context.

## Concurrent tests

Tests marked `.concurrent` (or in a `describe.concurrent`) run at the same time, up to `maxConcurrency` (5) at once. Use the `expect` of the test context in them, so each assertion belongs to its test.

```js
test.concurrent('loads the user', async ({ expect }) => {
  expect(await loadUser(1)).toMatchObject({ id: 1 });
});
```

## Tags and repeats

A `describe` or a `test` takes `tags`, which the tests inside inherit; `--tag` runs the tests with one of them and `--exclude-tag` leaves out those with any. `--grep-invert` leaves out the tests whose name matches, as `-t` (or `--grep`) keeps them. `--repeat-each 5` runs every test five times, and a test passes only when every run passes: how to find a flaky test, or measure an AI step under `--ai live`.

```js
describe('billing', { tags: ['billing'] }, () => {
  test('upgrades the plan', { tags: 'slow' }, async () => { /* ... */ });
});
```
