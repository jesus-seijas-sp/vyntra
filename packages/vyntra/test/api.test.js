const fs = require('node:fs');
const net = require('node:net');
const http = require('node:http');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { validate } = require('../src/api/schema');
const { ApiClient, resolveUrl } = require('../src/api/client');
const { copyFixture } = require('./helpers/run-fixture');

const BIN = path.join(__dirname, '..', 'bin', 'vyntra.js');

function freePort() {
  return new Promise((resolve) => {
    const probe = net.createServer().listen(0, () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

describe('validate (JSON Schema)', () => {
  const schema = {
    type: 'object',
    required: ['id', 'tags'],
    properties: {
      id: { type: 'integer', minimum: 1 },
      email: { type: 'string', format: 'email' },
      tags: { type: 'array', items: { enum: ['a', 'b'] }, uniqueItems: true },
      owner: { $ref: '#/$defs/person' },
    },
    additionalProperties: false,
    $defs: { person: { type: 'object', required: ['name'], properties: { name: { type: 'string' } } } },
  };

  it('accepts a matching value', () => {
    expect(validate({ id: 1, tags: ['a'], owner: { name: 'Ann' } }, schema)).toEqual([]);
  });

  it('reports every problem with its path', () => {
    expect(validate({ id: 0.5, email: 'nope', tags: ['a', 'a', 'c'], owner: {}, extra: 1 }, schema)).toEqual([
      { path: '/id', message: 'should be integer, but is number' },
      { path: '/email', message: 'should be a email, but is "nope"' },
      { path: '/tags', message: 'should have unique items' },
      { path: '/tags/2', message: 'should be one of "a", "b", but is "c"' },
      { path: '/owner', message: 'should have the property "name"' },
      { path: '/extra', message: 'is not an allowed property' },
    ]);
    expect(validate({}, schema)).toEqual([
      { path: '', message: 'should have the property "id"' },
      { path: '', message: 'should have the property "tags"' },
    ]);
  });

  it('combines schemas', () => {
    expect(validate(5, { anyOf: [{ type: 'string' }, { type: 'number' }] })).toEqual([]);
    expect(validate(5, { oneOf: [{ type: 'integer' }, { type: 'number' }] })[0].message).toBe(
      'should match exactly one of the oneOf schemas, but matches 2'
    );
    expect(validate(null, { type: ['string', 'null'] })).toEqual([]);
    expect(validate('x', { not: { type: 'string' } })).toHaveLength(1);
  });
});

describe('resolveUrl', () => {
  it('joins a path to the base URL, keeping its path', () => {
    expect(resolveUrl('/users', 'http://host/api').href).toBe('http://host/api/users');
    expect(resolveUrl('users?x=1', 'http://host/api/', { y: [2, 3] }).href).toBe('http://host/api/users?x=1&y=2&y=3');
    expect(resolveUrl('https://other.test/a', 'http://host/api').href).toBe('https://other.test/a');
  });

  it('needs a base URL for a path', () => {
    expect(() => resolveUrl('/users')).toThrow('there is no baseURL');
  });
});

describe('ApiClient', () => {
  let server;
  let baseURL;
  const seen = [];

  beforeAll(async () => {
    server = http.createServer((request, response) => {
      seen.push({ url: request.url, headers: request.headers });
      if (request.url === '/login') {
        response.setHeader('set-cookie', ['session=s1; Path=/', 'theme=dark']);
      }
      if (request.url === '/logout') {
        response.setHeader('set-cookie', 'session=; Max-Age=0');
      }
      response.setHeader('content-type', request.url === '/text' ? 'text/plain' : 'application/json');
      request.pipe(response);
    });
    const port = await freePort();
    await new Promise((resolve) => {
      server.listen(port, resolve);
    });
    baseURL = `http://localhost:${port}`;
  });

  afterAll(() => {
    server.close();
  });

  it('sends JSON and parses JSON, recording the exchange with secrets hidden', async () => {
    const exchanges = [];
    const api = new ApiClient({
      baseURL,
      headers: { authorization: 'Bearer t' },
      record: (one) => exchanges.push(one),
    });
    const response = await api.post('/echo', { a: 1 });
    expect(response).toMatchObject({ status: 200, ok: true, body: { a: 1 }, method: 'POST' });
    expect(seen.at(-1).headers).toMatchObject({ 'content-type': 'application/json', authorization: 'Bearer t' });
    expect(exchanges[0].request).toMatchObject({ method: 'POST', body: '{"a":1}' });
    expect(exchanges[0].request.headers.authorization).toBe('[redacted]');
    expect(exchanges[0].response).toMatchObject({ status: 200, body: '{"a":1}' });
  });

  it('keeps cookies for the requests after, until the server expires them', async () => {
    const api = new ApiClient({ baseURL });
    await api.get('/login');
    await api.get('/next');
    expect(seen.at(-1).headers.cookie).toBe('session=s1; theme=dark');
    await api.get('/logout');
    await api.get('/next');
    expect(seen.at(-1).headers.cookie).toBe('theme=dark');
  });

  it('keeps text as text, and says which request failed to connect', async () => {
    const api = new ApiClient({ baseURL });
    expect((await api.put('/text', 'plain')).body).toBe('plain');
    const nowhere = new ApiClient({ baseURL: 'http://localhost:1' });
    await expect(nowhere.get('/x')).rejects.toThrow('api: GET http://localhost:1/x failed');
  });

  it('is checked by the HTTP matchers', async () => {
    const api = new ApiClient({ baseURL });
    const response = await api.post('/echo', { a: 1 });
    expect(response).toHaveStatus('2xx');
    expect(response).not.toHaveStatus(404);
    expect(response).toHaveHeader('Content-Type', 'application/json');
    expect(response).not.toHaveHeader('x-missing');
    expect(response).toMatchSchema({ type: 'object', required: ['a'] });
    expect(() => expect(response).toHaveStatus(201)).toThrow(
      /Expected status: 201\nReceived status: 200\nPOST .*\/echo\nBody: \{"a":1\}/
    );
    expect(() => expect({ a: 'x' }).toMatchSchema({ properties: { a: { type: 'number' } } })).toThrow(
      '/a should be number, but is string'
    );
  });
});

describe('api fixture', () => {
  async function project(env = {}) {
    const dir = copyFixture('api-project');
    const port = await freePort();
    const result = spawnSync(process.execPath, [BIN, '--root', dir, '--no-color', '--reporter', 'default,markdown'], {
      encoding: 'utf8',
      env: { ...process.env, CI: '', GITHUB_ACTIONS: '', APP_PORT: String(port), ...env },
    });
    return { dir, ...result };
  }

  it('runs unit and API tests from one config, against the server it starts', async () => {
    const { status, stdout } = await project();
    expect(stdout).toContain('✓ [api] api/users.test.js (5 tests)');
    expect(status).toBe(0);
  });

  it('shows the request and the response on the page of a failing API test', async () => {
    const { dir, status } = await project({ BREAK_API: '1' });
    expect(status).toBe(1);
    const failures = path.join(dir, '.vyntra', 'failures');
    const page = fs.readFileSync(path.join(failures, fs.readdirSync(failures)[0]), 'utf8');
    expect(page).toMatch(/### Last request: POST http:\/\/localhost:\d+\/api\/users/);
    expect(page).toContain('{"name":"Cy"}');
    expect(page).toMatch(/```http\n422 \(\d+ms\)\n[^`]*\{"error":"email is required"\}\n```/);
    expect(page).toContain('app: POST /api/users');
  });
});
