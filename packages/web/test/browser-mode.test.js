const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const BIN = path.join(path.dirname(require.resolve('vyntra/package.json')), 'bin', 'vyntra.js');
const ROOT = path.join(__dirname, 'fixtures', 'browser-mode');

const statuses = (tests) =>
  Object.fromEntries(Object.entries(tests).map(([name, test]) => [name, [test.status, test.errors[0]?.message]]));

const INTERACTIONS = {
  'keyboard: text, named keys and keys held down': ['passed', undefined],
  'tab moves the focus, shift+tab back': ['passed', undefined],
  'selects options by value or label': ['passed', undefined],
  'hovers, double clicks, clears': ['passed', undefined],
  'waits for the element a locator means, and says when it is ambiguous': ['passed', undefined],
  'sets the viewport, and screenshots an element': ['passed', undefined],
};

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

  it('writes, matches and updates snapshots, stored and inline, of DOM elements as pretty-format prints them', () => {
    const file = path.join(ROOT, 'snapshots.test.js');
    const stored = path.join(ROOT, '__snapshots__', 'snapshots.test.js.snap');
    const source = (item) => `import { describe, expect, it } from 'vitest';

describe('snapshots', () => {
  it('of an element', () => {
    document.body.innerHTML = '<ul class="list"><li>${item}</li></ul>';
    expect(document.querySelector('ul')).toMatchSnapshot();
    expect({ width: window.innerWidth }).toMatchSnapshot('viewport');
  });

  it('inline', () => {
    expect({ items: ['a'] }).toMatchInlineSnapshot();
  });
});
`;
    try {
      fs.writeFileSync(file, source('One'));
      expect(run(['snapshots.test.js']).report.files[0].snapshot).toMatchObject({ added: 3, failed: 0 });
      expect(fs.readFileSync(stored, 'utf8')).toBe(`// Vitest Snapshot v1, https://vitest.dev/guide/snapshot.html

exports[\`snapshots > of an element 1\`] = \`
<ul
  class="list"
>
  <li>
    One
  </li>
</ul>
\`;

exports[\`snapshots > of an element: viewport 1\`] = \`
{
  "width": 414,
}
\`;
`);
      expect(fs.readFileSync(file, 'utf8')).toContain(`toMatchInlineSnapshot(\`
      {
        "items": [
          "a",
        ],
      }
    \`)`);
      expect(run(['snapshots.test.js']).status).toBe(0);

      fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('<li>One', '<li>Two'));
      const { status, tests } = run(['snapshots.test.js']);
      expect(status).toBe(1);
      expect(tests['snapshots of an element'].errors[0].message).toContain('+     Two');
      // The failed test's other snapshot is kept: not obsolete, so -u does not remove it.
      expect(run(['snapshots.test.js', '-u']).report.files[0].snapshot).toMatchObject({ updated: 1 });
      expect(fs.readFileSync(stored, 'utf8')).toContain('viewport 1');
    } finally {
      fs.rmSync(file, { force: true });
      fs.rmSync(path.dirname(stored), { recursive: true, force: true });
    }
  });

  it("reports the coverage of the project's files, from Chromium's V8 coverage of the page", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vyntra-browser-coverage-'));
    try {
      const { status } = run(['coverage.test.js', '--coverage', '--coverageDirectory', dir]);
      expect(status).toBe(0);
      const lcov = fs.readFileSync(path.join(dir, 'lcov.info'), 'utf8');
      const grade = lcov.split('end_of_record').find((record) => record.includes('src/grade.ts'));
      // As in Node: the function no test calls is uncovered, not tree-shaken away; esbuild's module wrappers are
      // not the file's functions or lines.
      expect(grade.match(/^(?:FN|FNDA|DA|BRDA):.*$/gm)).toEqual([
        'FN:3,grade',
        'FN:13,unused',
        'FN:17,label',
        'FNDA:2,grade',
        'FNDA:0,unused',
        'FNDA:1,label',
        'BRDA:4,0,0,1',
        'BRDA:9,1,0,-',
        'BRDA:17,2,0,-',
        'DA:3,2',
        'DA:4,2',
        'DA:5,1',
        'DA:7,1',
        'DA:8,1',
        'DA:10,0',
        'DA:13,0',
        'DA:14,0',
        'DA:17,1',
      ]);
      // Test files are not the project's code.
      expect(lcov).not.toContain('coverage.test.js');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('types, tabs, selects, hovers and waits for elements', () => {
    expect(statuses(run(['interactions.test.js']).tests)).toEqual(INTERACTIONS);
    fs.rmSync(path.join(ROOT, '__screenshots__'), { recursive: true, force: true });
  });

  describe('on WebdriverIO', () => {
    it('runs the same tests, with the same commands, in Chrome', () => {
      const { report, tests, status } = run([
        '--config',
        'vitest.webdriverio.config.mjs',
        'dom.test.js',
        'packages.test.js',
        'mocks.test.js',
        'interactions.test.js',
        'failing.test.js',
      ]);
      fs.rmSync(path.join(ROOT, '__screenshots__'), { recursive: true, force: true });
      expect(status).toBe(1);
      expect(Object.fromEntries(Object.entries(statuses(tests)).map(([name, [state]]) => [name, state]))).toEqual({
        'in a browser page lays out with the page styles': 'passed',
        'in a browser page types and clicks as a user, found by role': 'passed',
        'in a browser page keeps console output with the test': 'passed',
        'imports a CommonJS package, as React is': 'passed',
        'takes a screenshot': 'passed',
        'replaces a package with what the factory returns': 'passed',
        'replaces part of a module everywhere it is imported, keeping the rest': 'passed',
        'automocks a module without a factory': 'passed',
        ...Object.fromEntries(Object.keys(INTERACTIONS).map((name) => [name, 'passed'])),
        'fails where it is written': 'failed',
      });
      expect(tests['fails where it is written'].errors[0].stack).toContain(
        `${path.join(ROOT, 'failing.test.js')}:3:51`
      );
      const dom = report.files.find((file) => file.path.endsWith('dom.test.js'));
      expect(dom.console).toEqual([expect.objectContaining({ type: 'log', text: 'from the page' })]);
    });
  });
});
