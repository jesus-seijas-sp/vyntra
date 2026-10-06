const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { runFixture, copyFixture } = require('./helpers/run-fixture');

describe('custom test environments', () => {
  it.each([['2'], ['1']])('sets up a vitest environment for its files only (%s workers)', (workers) => {
    const { statuses } = runFixture('env-vitest', ['-w', workers]);
    expect(statuses).toEqual({
      'has what the environment set up': 'passed',
      'does not have it in another environment': 'passed',
    });
  });

  it.each([['2'], ['1']])(
    'runs a Jest environment class, and one a file names in its comment (%s workers)',
    (workers) => {
      const { statuses } = runFixture('env-jest', ['-w', workers]);
      expect(statuses).toEqual({
        'gets the global the environment class set up': 'passed',
        'takes another environment from its comment': 'passed',
      });
    }
  );

  it('fails the files of an environment it can not find, as a broken setup', () => {
    const dir = copyFixture('env-vitest');
    fs.writeFileSync(
      path.join(dir, 'vitest.config.mjs'),
      "export default { test: { environment: './missing.js' } };\n"
    );
    const { status, stdout } = spawnSync(
      process.execPath,
      [path.join(__dirname, '..', 'bin', 'vyntra.js'), '--root', dir, '--no-color', 'custom.test.js'],
      { encoding: 'utf8', env: { ...process.env, CI: '', GITHUB_ACTIONS: '' } }
    );
    expect(stdout).toContain('Can not find the test environment "./missing.js"');
    expect(status).toBe(2);
  });
});
