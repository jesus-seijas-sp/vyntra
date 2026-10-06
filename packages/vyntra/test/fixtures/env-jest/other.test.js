/**
 * @jest-environment ./other-environment.js
 */
test('takes another environment from its comment', () => {
  expect(other).toBe(true);
  expect(globalThis.db).toBeUndefined();
});
