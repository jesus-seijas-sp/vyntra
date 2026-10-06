test('runs as usual', () => {
  expectTypeOf(1).toEqualTypeOf<number>();
  expect(1 + 1).toBe(2);
});
