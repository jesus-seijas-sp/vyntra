import greeting from 'virtual:greeting';

test('imports a module a plugin resolves and loads', () => {
  expect(greeting).toBe('hello from a virtual module');
});
