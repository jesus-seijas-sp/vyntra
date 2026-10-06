const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');

const BIN = path.join(__dirname, '..', 'bin', 'vyntra.js');
const fixture = (name) => path.join(__dirname, 'fixtures', 'exit-codes', name);
const run = (name, ...args) =>
  spawnSync(process.execPath, [BIN, '--root', fixture(name), '--no-color', ...args], {
    encoding: 'utf8',
    env: { ...process.env, CI: '' },
  });

describe('exit codes', () => {
  it('is 0 when every test passed', () => {
    expect(run('passing').status).toBe(0);
  });

  it('is 1 when a test failed', () => {
    expect(run('failing').status).toBe(1);
  });

  it('is 2 when a file does not load, whatever the other files did', () => {
    const { status, stdout } = run('broken');
    expect(stdout).toContain('cannot load');
    expect(status).toBe(2);
  });

  it('is 2 for an .only with allowOnly: false', () => {
    expect(run('only').status).toBe(2);
  });

  it('is 2 when the config does not load', () => {
    const { status, stderr } = run('bad-config');
    expect(stderr).toContain('bad config');
    expect(status).toBe(2);
  });

  it('is 2 when no test files are found, 0 with passWithNoTests', () => {
    expect(run('passing', 'nothing-matches').status).toBe(2);
    expect(run('passing', 'nothing-matches', '--passWithNoTests').status).toBe(0);
  });

  it('is 2 for an invalid shard', () => {
    expect(run('passing', '--shard', '3/2').status).toBe(2);
  });

  it.each([['threads'], ['forks']])(
    'is 130 when interrupted (%s)',
    async (pool) => {
      const child = spawn(process.execPath, [BIN, '--root', fixture('slow'), '--no-color', '--pool', pool, '-w', '2'], {
        env: { ...process.env, CI: '' },
      });
      let output = '';
      child.stdout.on('data', (chunk) => {
        output += chunk;
        if (output.includes('running')) {
          setTimeout(() => child.kill('SIGINT'), 300);
        }
      });
      const code = await new Promise((resolve) => {
        child.on('exit', resolve);
      });
      expect(code).toBe(130);
      expect(output).toContain('Interrupted');
    },
    15000
  );
});
