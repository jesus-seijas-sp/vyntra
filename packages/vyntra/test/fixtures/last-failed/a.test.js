const ok = process.env.FIX === '1';
describe('math', () => {
  it('adds', () => expect(1 + 1).toBe(2));
  it('breaks', () => expect(ok).toBe(true));
});
it('also breaks', () => expect(ok).toBe(true));
