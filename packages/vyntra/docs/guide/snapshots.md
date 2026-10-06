# Snapshots

`toMatchSnapshot()` saves a value the first time, in `__snapshots__/<file>.snap`, and compares it with the saved one after. `toMatchInlineSnapshot()` writes it into the test itself:

```js
test('renders the invoice', () => {
  expect(render(invoice)).toMatchSnapshot();
  expect(total(invoice)).toMatchInlineSnapshot(`42`);
});

test('ids change, their type does not', () => {
  expect(createUser()).toMatchSnapshot({ id: expect.any(String) });
});
```

When a value changes on purpose, `vyntra -u` updates the snapshots, and removes the ones no test uses when every test of the file ran. On CI (`CI` set, or `--ci`) new snapshots are not written: a missing snapshot fails. The `.snap` files of Jest and Vitest are read and written in their own format, so existing snapshots keep matching.
