const { total } = require('./cart');

describe('total', () => {
  it('adds the items', () => {
    expect(total([{ price: 250, quantity: 2 }])).toBe(500);
  });

  it('takes the discount off', () => {
    console.log('discount: 10%');
    expect(total([{ price: 1000, quantity: 1 }], 10)).toBe(900);
  });
});
