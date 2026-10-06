test('runs in a, with its own setup', () => {
  expect(globalThis.setupBy).toBe('a');
});
