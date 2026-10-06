const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { runFixture } = require('./helpers/run-fixture');
const { resolveProjects } = require('../src/cli/projects');
const { fromVitestConfig } = require('../src/cli/vitest-config');

const BIN = path.join(__dirname, '..', 'bin', 'vyntra.js');
const ROOT = path.join(__dirname, 'fixtures', 'projects');

function run(args = [], env = {}) {
  const log = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'vyntra-projects-')), 'setup.log');
  const result = spawnSync(process.execPath, [BIN, '--root', ROOT, '--no-color', ...args], {
    encoding: 'utf8',
    env: { ...process.env, CI: '', GITHUB_ACTIONS: '', SETUP_LOG: log, ...env },
  });
  const steps = fs.existsSync(log) ? fs.readFileSync(log, 'utf8').trim().split('\n') : [];
  return { ...result, steps };
}

const byProject = (report) =>
  Object.fromEntries(report.files.map((file) => [path.relative(ROOT, file.path), file.project]));

describe('projects', () => {
  it('runs each project with its own options, in the order of dependsOn', () => {
    const report = runFixture('projects');
    expect(report.success).toBe(true);
    expect(byProject(report)).toEqual({
      'unit/math.test.js': 'unit',
      'shared.test.js': 'unit',
      'api/users.test.js': 'api',
      'e2e/flow.test.js': 'e2e',
      'e2e/esm.test.mjs': 'e2e',
    });
  });

  it('runs the setup of the run around every project, and each project between its own', () => {
    const { status, steps } = run();
    expect(status).toBe(0);
    expect(steps).toEqual(['run setup', 'api setup', 'api teardown', 'run teardown']);
  });

  it('names the project of each file, and the projects in the header', () => {
    const { stdout } = run();
    expect(stdout).toContain('running 5 test files (projects: unit, api, e2e)');
    expect(stdout).toContain('✓ [api] api/users.test.js');
  });

  it('skips the projects that depend on one that failed, and those that depend on them', () => {
    const { status, stdout } = run([], { UNIT_FAILS: '1' });
    expect(status).toBe(1);
    expect(stdout).toContain('Project api skipped: unit did not pass');
    expect(stdout).toContain('Project e2e skipped: api did not pass');
    expect(stdout).not.toContain('[api] api/users.test.js');
  });

  it('reports a globalSetup that throws against its file, as a broken setup, and skips what depends on it', () => {
    const { status, stdout, steps } = run([], { API_SETUP_FAILS: '1' });
    expect(status).toBe(2);
    expect(stdout).toContain('FAIL  Suite error [api] setup/api.js');
    expect(stdout).toContain('Error: the api seed failed');
    expect(stdout).toContain('Project e2e skipped: api did not pass');
    expect(steps).toEqual(['run setup', 'api setup', 'run teardown']);
  });

  it('runs only the projects asked for, whose files stay theirs', () => {
    const report = runFixture('projects', ['--project', 'api,e2e']);
    expect(byProject(report)).toEqual({
      'api/users.test.js': 'api',
      'e2e/flow.test.js': 'e2e',
      'e2e/esm.test.mjs': 'e2e',
    });
    expect(report.success).toBe(true);
  });

  it('refuses an unknown project', () => {
    const { status, stderr } = run(['--project', 'nope']);
    expect(status).toBe(2);
    expect(stderr).toContain('Unknown project: nope (unit, api, e2e)');
  });
});

describe('resolveProjects', () => {
  const resolve = (projects) => () => resolveProjects({ rootDir: ROOT, setupFiles: [], projects });

  it('refuses projects that depend on each other, unknown dependencies and repeated names', () => {
    expect(
      resolve([
        { name: 'a', dependsOn: 'b' },
        { name: 'b', dependsOn: ['a'] },
      ])
    ).toThrow('Projects depend on each other: a -> b -> a');
    expect(resolve([{ name: 'a', dependsOn: ['x'] }])).toThrow('Unknown projects in dependsOn: a depends on x');
    expect(resolve([{ name: 'a' }, { name: 'a' }])).toThrow('Two projects are named "a"');
  });

  it('gives each project the top level options, but not the run ones', () => {
    const { projects } = resolveProjects({
      rootDir: ROOT,
      setupFiles: [],
      testTimeout: 1000,
      reporter: ['junit'],
      use: { a: 1, b: 1 },
      projects: [{ name: 'x', testTimeout: 50, use: { b: 2 } }, {}],
    });
    expect(projects[0].config).toMatchObject({ testTimeout: 50, use: { a: 1, b: 2 }, projectName: 'x' });
    expect(projects[0].config.reporter).toBeUndefined();
    expect(projects[1].name).toBe('project-2');
    expect(projects[1].config.testTimeout).toBe(1000);
  });
});

describe('globalSetup from vitest', () => {
  it('reads it from a vitest config, from its root', () => {
    const config = fromVitestConfig({ test: { globalSetup: './setup.ts' } }, ROOT);
    expect(config.globalSetup).toEqual([path.join(ROOT, 'setup.ts')]);
  });
});
