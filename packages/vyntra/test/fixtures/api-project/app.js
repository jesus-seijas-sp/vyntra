const http = require('node:http');

// The API under test: users, and a session cookie.
const users = [{ id: 1, name: 'Ann', email: 'ann@example.com' }];
const send = (response, status, body, headers = {}) => {
  response.writeHead(status, { 'content-type': 'application/json', ...headers });
  response.end(JSON.stringify(body));
};

http
  .createServer(async (request, response) => {
    let raw = '';
    for await (const chunk of request) {
      raw += chunk;
    }
    const url = new URL(request.url, 'http://localhost');
    console.log(`app: ${request.method} ${url.pathname}${url.search}`);
    if (url.pathname === '/health') {
      return send(response, 200, { ok: true });
    }
    if (url.pathname === '/api/users' && request.method === 'GET') {
      const name = url.searchParams.get('name');
      return send(response, 200, name ? users.filter((user) => user.name === name) : users);
    }
    if (url.pathname === '/api/users' && request.method === 'POST') {
      const body = JSON.parse(raw);
      if (!body.email) {
        return send(response, 422, { error: 'email is required' });
      }
      const user = { id: users.length + 1, ...body };
      users.push(user);
      return send(response, 201, user, { location: `/api/users/${user.id}` });
    }
    if (url.pathname === '/api/login') {
      return send(response, 204, null, { 'set-cookie': 'session=abc; HttpOnly; Path=/' });
    }
    if (url.pathname === '/api/me') {
      const signedIn = (request.headers.cookie ?? '').includes('session=abc');
      return signedIn ? send(response, 200, users[0]) : send(response, 401, { error: 'sign in first' });
    }
    return send(response, 404, { error: `no ${url.pathname}` });
  })
  .listen(Number(process.env.PORT), () => console.log(`app: listening on ${process.env.PORT}`));
