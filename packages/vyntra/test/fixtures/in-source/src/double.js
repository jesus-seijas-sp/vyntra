export const double = (n) => n * 2;

if (import.meta.vitest) {
  const { it, expect } = import.meta.vitest;
  it('doubles', () => {
    expect(double(3)).toBe(6);
  });
}
