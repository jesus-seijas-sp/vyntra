test('gets the global the environment class set up', () => {
  expect(db).toEqual({ name: 'test-db', file: 'db.test.js' });
  expect(typeof setTimeout).toBe('function');
});
