const { isEmail } = require('./validate');

test('accepts an email', () => {
  expect(isEmail('ann@example.com')).toBe(true);
});
