test('runs inline, extending the root config', () => {
  expect(globalThis.setupBy).toBe('root');
});
