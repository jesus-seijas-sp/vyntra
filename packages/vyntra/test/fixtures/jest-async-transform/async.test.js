test('runs through a transformer that only has processAsync', () => {
  expect(__TRANSFORMED__).toBe('by processAsync');
});
