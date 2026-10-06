import { add } from './src/math.js';

test('imports a module with in-source tests without running them', () => {
  expect(add(2, 2)).toBe(4);
});
