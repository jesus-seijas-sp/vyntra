const { inject } = require('vyntra');

test('gets the run options, not another project\'s', ({ greeting }) => {
  expect(greeting).toBe('top');
  expect(inject('runValue')).toBe(42);
  expect(inject('apiPort')).toBeUndefined();
});
