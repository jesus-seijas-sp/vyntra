// The transformer drops these comment lines and the blank ones.

describe('a transformed file', () => {

  it('fails on its seventh line', () => {
    expect('compiled').toBe('written');
  });
});
