const path = require('node:path');
const { runFixture } = require('./helpers/run-fixture');
const { expandGlob } = require('../src/cli/foreign-projects');

const FIXTURES = path.join(__dirname, 'fixtures');

const projectsOf = (name, args = []) => {
  const report = runFixture(name, args);
  const files = report.files.map((file) => [path.relative(path.join(FIXTURES, name), file.path), file.project]);
  return { report, files: Object.fromEntries(files) };
};

describe('vitest projects', () => {
  it('runs each project of test.projects from its folder, with its own config or none', () => {
    const { report, files } = projectsOf('vitest-projects');
    expect(files).toEqual({
      'packages/a/a.test.js': 'a',
      'packages/b/b.test.js': '@demo/b',
      'inline/inline.test.js': 'inline',
    });
    expect(report.success).toBe(true);
  });

  it('takes the projects of a vitest.workspace file', () => {
    expect(projectsOf('vitest-workspace').files).toEqual({ 'packages/c/c.test.js': 'c' });
  });

  it('runs the projects asked for by their vitest names', () => {
    expect(projectsOf('vitest-projects', ['--project', '@demo/b']).files).toEqual({
      'packages/b/b.test.js': '@demo/b',
    });
  });
});

describe('Jest projects', () => {
  it('runs each project from its rootDir, with its displayName, config file or package.json', () => {
    const { report, files } = projectsOf('jest-projects');
    expect(files).toEqual({
      'packages/x/x.test.js': 'x',
      'packages/y/y.test.js': 'y',
      'inline/inline.test.js': 'inline',
    });
    expect(report.success).toBe(true);
  });
});

describe('expandGlob', () => {
  const root = path.join(FIXTURES, 'jest-projects');

  it('finds the folders and files a glob matches, and a path as it is', () => {
    expect(expandGlob('packages/*', root)).toEqual([path.join(root, 'packages/x'), path.join(root, 'packages/y')]);
    expect(expandGlob('packages/*/jest.config.js', root)).toEqual([path.join(root, 'packages/x/jest.config.js')]);
    expect(expandGlob('inline', root)).toEqual([path.join(root, 'inline')]);
    expect(expandGlob('missing', root)).toEqual([]);
  });
});
