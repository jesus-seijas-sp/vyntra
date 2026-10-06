import { total } from './cart.ts';

// Blank lines and comments above the failures move them in the compiled code.

describe('total', () => {

  it('adds the prices', () => {

    expect(total([100, 250], 0)).toBe(999);
  });

  it('refuses a discount over 100', () => {
    total([100], 150);
  });
});
