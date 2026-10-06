const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { runFixture } = require('./helpers/run-fixture');

describe('fixture scopes', () => {
  it.each([['threads'], ['forks']])(
    'sets a worker fixture up once per worker, a file fixture once per file (%s)',
    (pool) => {
      const { statuses } = runFixture('scopes', ['-w', '1', '--pool', pool]);
      expect(statuses).toEqual({
        'a: first': 'passed',
        'a: second': 'passed',
        'b: first': 'passed',
        'b: second': 'passed',
      });
    }
  );

  it('fails every test of a worker fixture whose setup failed, with the same error', () => {
    const { tests } = runFixture('scopes-errors');
    expect(tests['fails with the setup error'].errors[0].message).toBe('setup 1 failed');
    expect(tests['fails at once with the same error'].errors[0].message).toBe('setup 1 failed');
  });

  it('does not let a worker fixture use a test fixture', () => {
    const { tests } = runFixture('scopes-errors');
    expect(tests['a worker fixture can not use a test fixture'].errors[0].message).toBe(
      'The worker fixture leaky can not use the test fixture perTest'
    );
  });

  it('reports a worker fixture whose teardown fails, and fails the run', () => {
    const bin = path.join(__dirname, '..', 'bin', 'vyntra.js');
    const { status, stderr } = spawnSync(
      process.execPath,
      [bin, '--root', path.join(__dirname, 'fixtures', 'scopes-errors'), '-t', 'teardown fails'],
      { encoding: 'utf8', env: { ...process.env, CI: '', GITHUB_ACTIONS: '' } }
    );
    expect(stderr).toContain('A worker fixture failed to tear down:\nError: teardown failed');
    expect(status).toBe(1);
  });
});
