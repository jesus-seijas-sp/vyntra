import { double } from './double.js';

export const add = (a, b) => a + b;
export const quadruple = (n) => double(double(n));

if (import.meta.vitest) {
  const { it, expect, describe } = import.meta.vitest;

  describe('math', () => {
    it('adds', () => {
      expect(add(1, 2)).toBe(3);
    });

    it('quadruples', () => {
      expect(quadruple(2)).toBe(8);
    });
  });
}
