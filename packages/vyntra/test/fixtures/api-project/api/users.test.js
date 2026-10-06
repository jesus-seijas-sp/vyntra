const user = {
  type: 'object',
  required: ['id', 'name', 'email'],
  properties: {
    id: { type: 'integer', minimum: 1 },
    name: { type: 'string', minLength: 1 },
    email: { type: 'string', format: 'email' },
  },
  additionalProperties: false,
};

test('lists users', async ({ api }) => {
  const response = await api.get('/users');
  expect(response).toHaveStatus(200);
  expect(response).toHaveHeader('content-type', /json/);
  expect(response).toMatchSchema({ type: 'array', items: user });
});

test('filters users by name', async ({ api }) => {
  const response = await api.get('/users', { query: { name: 'Ann' } });
  expect(response.body).toHaveLength(1);
});

test('creates a user', async ({ api }) => {
  const response = await api.post('/users', { name: 'Bo', email: 'bo@example.com' });
  expect(response).toHaveStatus(201);
  expect(response).toHaveHeader('location', expect.stringMatching(/^\/api\/users\/\d+$/));
  expect(response.body).toMatchSchema(user);
});

test('keeps the session cookie for the test', async ({ api }) => {
  expect(await api.get('/me')).toHaveStatus(401);
  expect(await api.post('/login')).toHaveStatus('2xx');
  const me = await api.get('/me');
  expect(me).toHaveStatus(200);
  expect(me.body.name).toBe('Ann');
});

test('refuses a user without email', async ({ api }) => {
  const response = await api.post('/users', { name: 'Cy' });
  expect(response).toHaveStatus(process.env.BREAK_API ? 201 : 422);
});
