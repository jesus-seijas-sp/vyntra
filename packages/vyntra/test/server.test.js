const fs = require('node:fs');
const net = require('node:net');
const http = require('node:http');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');
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

const up = (port) =>
  fetch(`http://localhost:${port}/health`).then(
    () => true,
    () => false
  );

async function project(env = {}) {
  const dir = copyFixture('server');
  const port = await freePort();
  const run = (args = [], extra = {}) =>
    spawnSync(process.execPath, [BIN, '--root', dir, '--no-color', ...args], {
      encoding: 'utf8',
      env: { ...process.env, CI: '', GITHUB_ACTIONS: '', APP_PORT: String(port), ...env, ...extra },
    });
  // For a test whose own process serves requests while vyntra runs: spawnSync would block it.
  const runAsync = (args = [], extra = {}) =>
    new Promise((resolve) => {
      const child = spawn(process.execPath, [BIN, '--root', dir, '--no-color', ...args], {
        env: { ...process.env, CI: '', GITHUB_ACTIONS: '', APP_PORT: String(port), ...env, ...extra },
      });
      let stdout = '';
      child.stdout.on('data', (chunk) => {
        stdout += chunk;
      });
      child.on('exit', (status) => resolve({ status, stdout }));
    });
  return { dir, port, run, runAsync };
}

describe('server', () => {
  it('starts the command, waits for its url, and stops it after the tests', async () => {
    const { port, run } = await project({ EXPECT_MISSING: '1' });
    const { status } = run();
    expect(status).toBe(0);
    expect(await up(port)).toBe(false);
  });

  it('puts what the server printed on the failure pages of its tests', async () => {
    const { dir, run } = await project();
    const { status } = run(['--reporter', 'default,markdown']);
    expect(status).toBe(1);
    const failures = path.join(dir, '.vyntra', 'failures');
    const page = fs.readFileSync(path.join(failures, fs.readdirSync(failures)[0]), 'utf8');
    expect(page).toMatch(/## Server output\n\n.*\n\n```text\n[^`]*app: GET \/missing\n```/);
  });

  it('fails the run as an environment problem when the command exits, with its output', async () => {
    const { run } = await project({ APP_CRASHES: '1' });
    const { status, stdout } = run();
    expect(status).toBe(3);
    expect(stdout).toContain('ServerError: The server command "node app.js" exited with code 3');
    expect(stdout).toContain('app: missing DATABASE_URL');
  });

  it('fails when the server does not answer in time', async () => {
    const { run } = await project();
    const { status, stdout } = run([], { APP_TIMEOUT: '1', APP_PORT: '1' });
    expect(status).toBe(3);
    expect(stdout).toMatch(/did not answer at http:\/\/localhost:1\/health within 1ms|exited with code/);
  });

  it('uses a server already running with reuseExisting, and refuses it without', async () => {
    const { port, runAsync } = await project({ EXPECT_MISSING: '1' });
    const running = http.createServer((request, response) => {
      response.statusCode = request.url === '/missing' ? 404 : 200;
      response.end('[{"id":1,"name":"Ann"}]');
    });
    await new Promise((resolve) => {
      running.listen(port, resolve);
    });
    try {
      expect((await runAsync([], { APP_REUSE: '1' })).status).toBe(0);
      const refused = await runAsync();
      expect(refused.status).toBe(3);
      expect(refused.stdout).toContain(`Something already answers at http://localhost:${port}/health`);
      expect(await up(port)).toBe(true);
    } finally {
      running.close();
    }
  });

  it('stops the server when the run is interrupted', async () => {
    const { dir, port } = await project();
    fs.writeFileSync(
      path.join(dir, 'slow.test.js'),
      "test('waits', ({ server }) => new Promise((resolve) => { setTimeout(resolve, 30000, server); }));\n"
    );
    const child = spawn(process.execPath, [BIN, '--root', dir, '--no-color', 'slow.test.js'], {
      env: { ...process.env, CI: '', GITHUB_ACTIONS: '', APP_PORT: String(port) },
    });
    let output = '';
    child.stdout.on('data', (chunk) => {
      output += chunk;
    });
    await new Promise((resolve) => {
      const poll = setInterval(async () => {
        if (output.includes('running') && (await up(port))) {
          clearInterval(poll);
          resolve();
        }
      }, 50);
    });
    child.kill('SIGINT');
    const code = await new Promise((resolve) => {
      child.on('exit', resolve);
    });
    expect(code).toBe(130);
    await new Promise((resolve) => {
      setTimeout(resolve, 200);
    });
    expect(await up(port)).toBe(false);
  }, 20000);
});
