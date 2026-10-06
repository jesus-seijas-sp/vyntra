const fixed = process.env.FIX === '1';
let attempts = 0;

describe('math', () => {
  it('adds <&>', () => {
    console.log('adding "1" & <1>');
    expect(1 + 1).toBe(fixed ? 2 : 3);
  });

  it('retries', { retry: 1 }, () => {
    attempts += 1;
    expect(attempts).toBe(2);
  });

  it('passes', () => {
    expect(1).toBe(1);
  });

  it.skip('waits', () => {});
});
