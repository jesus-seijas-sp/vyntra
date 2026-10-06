const mode: string = import.meta.env.MODE;

test('works in TypeScript Node strips', () => {
  expect(mode).toBe('test');
});
