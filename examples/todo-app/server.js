const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

// The todo app: the page, its script, and a JSON API of todo lists. Each list is apart from the others, so tests
// running at once each use their own.
const port = Number(process.env.PORT ?? 4321);
const lists = new Map();
const FILES = {
  '/': ['public/index.html', 'text/html'],
  '/app.mjs': ['public/app.mjs', 'text/javascript'],
  '/todos.mjs': ['src/todos.mjs', 'text/javascript'],
};

const json = (response, status, body) => {
  response.writeHead(status, { 'content-type': 'application/json' });
  response.end(body === undefined ? '' : JSON.stringify(body));
};

async function readJson(request) {
  let raw = '';
  for await (const chunk of request) {
    raw += chunk;
  }
  return raw ? JSON.parse(raw) : {};
}

async function api(request, response, url) {
  const [, , , list, , id] = url.pathname.split('/');
  const todos = lists.get(list) ?? [];
  lists.set(list, todos);
  const { cleanTitle } = await import('./src/todos.mjs');
  if (request.method === 'GET' && !id) {
    return json(response, 200, todos);
  }
  if (request.method === 'POST' && !id) {
    const { title } = await readJson(request);
    try {
      const todo = { id: todos.length + 1, title: cleanTitle(title), done: false };
      todos.push(todo);
      return json(response, 201, todo);
    } catch (error) {
      return json(response, 422, { error: error.message });
    }
  }
  const todo = todos.find((one) => one.id === Number(id));
  if (!todo) {
    return json(response, 404, { error: `No todo ${id}` });
  }
  if (request.method === 'PATCH') {
    Object.assign(todo, { done: Boolean((await readJson(request)).done) });
    return json(response, 200, todo);
  }
  if (request.method === 'DELETE') {
    todos.splice(todos.indexOf(todo), 1);
    return json(response, 204);
  }
  return json(response, 405, { error: `${request.method} is not allowed` });
}

http
  .createServer(async (request, response) => {
    const url = new URL(request.url, 'http://localhost');
    console.log(`${request.method} ${url.pathname}${url.search}`);
    if (url.pathname === '/health') {
      return json(response, 200, { ok: true });
    }
    if (url.pathname.startsWith('/api/lists/')) {
      return api(request, response, url);
    }
    const file = FILES[url.pathname];
    if (!file) {
      return json(response, 404, { error: 'Not found' });
    }
    response.writeHead(200, { 'content-type': file[1] });
    return fs.createReadStream(path.join(__dirname, file[0])).pipe(response);
  })
  .listen(port, () => console.log(`Todo app on http://localhost:${port}`));
