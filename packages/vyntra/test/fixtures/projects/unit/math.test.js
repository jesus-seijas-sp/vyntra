test('adds', () => {
  expect(globalThis.loadedBy).toBe('unit setup');
  expect(1 + 1).toBe(process.env.UNIT_FAILS ? 3 : 2);
});
