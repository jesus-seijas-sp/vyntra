test('has its code through an async transform', () => {
  expect(__ASYNC__).toBe('rewritten asynchronously');
});
