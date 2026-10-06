test('runs in the first project that includes it', () => {
  expect(globalThis.loadedBy).toBe('unit setup');
});
