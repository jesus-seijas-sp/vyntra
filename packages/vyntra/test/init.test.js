const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const BIN = path.join(__dirname, '..', 'bin', 'vyntra.js');
// The config a project ended up with, read fresh.
const configIn = (dir) => {
  const file = path.join(dir, 'vyntra.config.js');
  delete require.cache[file];
  // eslint-disable-next-line global-require -- the file init wrote
  return require(file);
};

const run = (args, cwd) =>
  spawnSync(process.execPath, [BIN, ...args], { cwd, encoding: 'utf8', env: { ...process.env, CI: '' } });

// A project as it is before vyntra: a package.json, an MCP server of its own, a .gitignore, and an app.
function project(port) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vyntra-wizard-'));
  fs.writeFileSync(
    path.join(dir, 'package.json'),
    JSON.stringify({ name: 'shop', scripts: { test: 'echo "Error: no test specified" && exit 1' } })
  );
  fs.writeFileSync(path.join(dir, '.mcp.json'), JSON.stringify({ mcpServers: { other: { command: 'other' } } }));
  fs.writeFileSync(path.join(dir, '.gitignore'), 'node_modules/');
  fs.writeFileSync(
    path.join(dir, 'server.js'),
    `require('node:http').createServer((q, r) => r.end('<h1>Shop</h1>')).listen(${port});\n`
  );
  return dir;
}

describe('vyntra init', () => {
  it('sets the project up for every kind of test, and says what to install', () => {
    const port = 43_000 + Math.floor(Math.random() * 1_000);
    const dir = project(port);
    const args = ['init', '--yes', '--kinds', 'api,e2e,ai', '--provider', 'openrouter'];
    const { status, stdout } = run([...args, '--command', 'node server.js', '--url', `http://localhost:${port}`], dir);
    expect(status).toBe(0);
    const config = configIn(dir);
    expect(config.server).toMatchObject({ command: 'node server.js', url: `http://localhost:${port}` });
    expect(config.use).toEqual({ baseURL: `http://localhost:${port}`, ai: { provider: 'openrouter' } });
    expect(config.projects.map((one) => [one.name, one.engine ?? null])).toEqual([
      ['unit', null],
      ['api', null],
      ['e2e', ['web', 'ai']],
    ]);
    [
      'tests/api/example.test.js',
      'tests/e2e/example.e2e.js',
      'tests/e2e/example-ai.e2e.js',
      '.agents/skills/vyntra/SKILL.md',
    ].forEach((file) => expect(fs.existsSync(path.join(dir, file))).toBe(true));
    expect(JSON.parse(fs.readFileSync(path.join(dir, '.mcp.json'), 'utf8')).mcpServers).toEqual({
      other: { command: 'other' },
      vyntra: { command: 'npx', args: ['vyntra-mcp'] },
    });
    expect(fs.readFileSync(path.join(dir, '.gitignore'), 'utf8')).toContain('\n.vyntra/\n');
    expect(JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')).scripts.test).toBe('vyntra');
    expect(stdout).toContain('npm install -D vyntra @vyntra/mcp @vyntra/web playwright @vyntra/ai');
    expect(stdout).toContain('export OPENROUTER_API_KEY=...');
    // A second init replaces nothing without --force.
    expect(run(['init', '--yes'], dir).status).toBe(1);
  });

  it('writes an API example that runs against the app the config starts', () => {
    const port = 44_000 + Math.floor(Math.random() * 1_000);
    const dir = project(port);
    run(['init', '--yes', '--kinds', 'api', '--command', 'node server.js', '--url', `http://localhost:${port}`], dir);
    const api = run(['--project', 'api', '--no-color'], dir);
    expect(api.stdout).toContain('Tests  1 passed (1)');
  });

  it('keeps a project that needs no server to a unit project', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vyntra-wizard-'));
    expect(run(['init', '--yes', '--kinds', ''], dir).status).toBe(0);
    const config = configIn(dir);
    expect(config.server).toBeUndefined();
    expect(config.projects.map((one) => one.name)).toEqual(['unit']);
  });

  it('asks what it does not know', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vyntra-wizard-'));
    const answers = ['e2e,ai', 'node app.js', 'http://localhost:5050', 'openai', 'gpt-test'];
    const asked = spawnSync(process.execPath, [BIN, 'init', '--ask'], {
      cwd: dir,
      input: `${answers.join('\n')}\n`,
      encoding: 'utf8',
      env: { ...process.env, CI: '' },
    });
    expect(asked.status).toBe(0);
    expect(asked.stdout).toContain('Kinds of tests besides unit tests: api, e2e, ai (api,e2e): ');
    const config = configIn(dir);
    expect(config.server).toMatchObject({ command: 'node app.js', url: 'http://localhost:5050' });
    expect(config.use.ai).toEqual({ provider: 'openai', model: 'gpt-test' });
    expect(config.projects.map((one) => one.name)).toEqual(['unit', 'e2e']);
  });
});
