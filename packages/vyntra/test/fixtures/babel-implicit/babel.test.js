test('runs through babel-jest without a transform in the config', () => {
  expect(__BABEL__).toBe('compiled by babel');
});
