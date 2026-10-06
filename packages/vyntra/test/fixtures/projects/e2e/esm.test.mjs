import { inject } from 'vitest';

test('reads a value provided by the run setup, from an ES module', () => {
  expect(inject('runValue')).toBe(42);
});
