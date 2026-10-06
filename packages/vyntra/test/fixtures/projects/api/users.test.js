const { inject } = require('vyntra');

test('reads what the setups provided, and its own options', ({ greeting }) => {
  expect(inject('runValue')).toBe(42);
  expect(inject('apiPort')).toBe(4000);
  expect(greeting).toBe('api');
  expect(globalThis.loadedBy).toBeUndefined();
});
