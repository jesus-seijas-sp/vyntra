test('runs in x, with its setup from its own rootDir', () => {
  expect(globalThis.setupBy).toBe('x');
});
