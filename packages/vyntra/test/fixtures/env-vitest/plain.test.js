/**
 * @vitest-environment node
 */
test('does not have it in another environment', () => {
  expect(globalThis.greet).toBeUndefined();
});
