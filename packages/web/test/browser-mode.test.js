const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const BIN = path.join(path.dirname(require.resolve('vyntra/package.json')), 'bin', 'vyntra.js');
const ROOT = path.join(__dirname, 'fixtures', 'browser-mode');

function run(args = []) {
  const { stdout, status } = spawnSync(
    process.execPath,
    [BIN, '--root', ROOT, '--no-color', '--reporter', 'json', ...args],
    {
      encoding: 'utf8',
      env: { ...process.env, CI: '', GITHUB_ACTIONS: '' },
    }
  );
  const report = JSON.parse(stdout.split('\n').find((line) => line.startsWith('{"success"')));
  const tests = Object.fromEntries(report.files.flatMap((file) => file.tests.map((test) => [test.name, test])));
  return { report, tests, status };
}

describe('browser mode', () => {
  it('runs test files in a browser page, with userEvent, locators and expect.element', () => {
    const { tests } = run(['dom.test.js', 'packages.test.js']);
    expect(Object.fromEntries(Object.entries(tests).map(([name, test]) => [name, test.status]))).toEqual({
      'in a browser page lays out with the page styles': 'passed',
      'in a browser page types and clicks as a user, found by role': 'passed',
      'in a browser page keeps console output with the test': 'passed',
      'imports a CommonJS package, as React is': 'passed',
      'takes a screenshot': 'passed',
    });
    fs.rmSync(path.join(ROOT, '__screenshots__'), { recursive: true, force: true });
  });

  it('keeps console output, and reports failures at the lines of the test file', () => {
    const { report, tests, status } = run(['dom.test.js', 'failing.test.js']);
    expect(status).toBe(1);
    const failure = tests['fails where it is written'].errors[0];
    expect(failure.message).toContain('Expected: "Hello"');
    expect(failure.stack).toContain(`${path.join(ROOT, 'failing.test.js')}:3:51`);
    const dom = report.files.find((file) => file.path.endsWith('dom.test.js'));
    expect(dom.console).toEqual([expect.objectContaining({ type: 'log', text: 'from the page' })]);
  });

  it('mocks modules with vi.mock: factories, importOriginal, automocks', () => {
    const { tests } = run(['mocks.test.js']);
    expect(
      Object.fromEntries(Object.entries(tests).map(([name, test]) => [name, [test.status, test.errors[0]?.message]]))
    ).toEqual({
      'replaces a package with what the factory returns': ['passed', undefined],
      'replaces part of a module everywhere it is imported, keeping the rest': ['passed', undefined],
      'automocks a module without a factory': ['passed', undefined],
    });
  });
});
