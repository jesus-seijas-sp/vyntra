export const shout = (text: string): string => text.toUpperCase();

if (import.meta.vitest) {
  const { test, expect } = import.meta.vitest;
  test('shouts', () => {
    expect(shout('hi')).toBe('HI');
  });
}
