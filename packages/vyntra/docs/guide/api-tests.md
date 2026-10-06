# API tests

The `api` fixture is an HTTP client for the test. It sends and reads JSON, joins paths to `use.baseURL` (or to the server's address, without one), and keeps the cookies the server sets for the rest of the test. Tests check its responses with `toHaveStatus`, `toHaveHeader` and `toMatchSchema`:

```js
// vyntra.config.js: a project for the API, with the server it tests
{
  name: 'api',
  include: ['test/api/**/*.test.ts'],
  server: { command: 'npm run start:test', url: 'http://localhost:4000/health' },
  use: { baseURL: 'http://localhost:4000/api' },
}

// test/api/users.test.ts
test('creates a user', async ({ api }) => {
  const response = await api.post('/users', { name: 'Bo', email: 'bo@example.com' });
  expect(response).toHaveStatus(201);
  expect(response).toHaveHeader('location', /^\/api\/users\/\d+$/);
  expect(response.body).toMatchSchema(userSchema);
});
```

It records every request and its response. When a test fails, its page in the `markdown` report shows them, the last one first, with the server's last lines: what was sent, what came back, and what the server said about it. Authorization headers and cookies are hidden there. API tests run in the `node` environment, as fast as unit tests.
