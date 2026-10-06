import { mul } from './src/mul.js';

test('multiplies', () => {
  expect(mul(2, 3)).toBe(6);
});
