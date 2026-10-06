test('runs in b, which has no config and none of the root one', () => {
  expect(globalThis.setupBy).toBeUndefined();
});
