const fs = require('node:fs');
const path = require('node:path');
const { runFixture, copyFixture } = require('./helpers/run-fixture');
const { testsOf, parseDiagnostics } = require('../src/cli/typecheck');

describe('--typecheck', () => {
  it('checks the type tests, each error on its test, and runs the other tests', () => {
    const { statuses, tests } = runFixture('typecheck', ['--typecheck']);
    expect(statuses).toEqual({
      'add > takes numbers': 'passed',
      'add > returns a number': 'failed',
      'runs as usual': 'passed',
    });
    expect(tests['add > returns a number'].errors[0]).toMatchObject({
      name: 'TypeCheckError',
      message: "Type 'number' is not assignable to type 'string'. (TS2322)",
    });
  });

  it('checks only the types with --typecheck.only', () => {
    const { statuses } = runFixture('typecheck', ['--typecheck.only']);
    expect(Object.keys(statuses)).toEqual(['add > takes numbers', 'add > returns a number']);
  });

  it('fails the run on errors in other files, unless ignoreSourceErrors', () => {
    const dir = copyFixture('typecheck');
    fs.appendFileSync(path.join(dir, 'src', 'math.ts'), "export const broken: number = 'x'; // type-error: nope\n");
    const failing = runFixture(dir, ['--typecheck.only']);
    expect(failing.files.find((file) => file.path.endsWith('math.ts')).errors[0].message).toBe('nope (TS2322)');
    fs.writeFileSync(
      path.join(dir, 'vitest.config.mjs'),
      'export default { test: { typecheck: { ignoreSourceErrors: true } } };\n'
    );
    const ignoring = runFixture(dir, ['--typecheck.only']);
    expect(ignoring.files.some((file) => file.path.endsWith('math.ts'))).toBe(false);
  });

  it('runs expectTypeOf and assertType as no-ops otherwise', () => {
    expect(runFixture('typecheck').statuses['runs as usual']).toBe('passed');
  });
});

describe('testsOf', () => {
  it('finds tests and suites and where their calls end, without running them', () => {
    const source = "describe('a', () => {\n  it.skip('b', () => {});\n  test(`c`, () => {});\n});\nfoo('d');\n";
    expect(testsOf(source).map(({ path: names, kind }) => [names.join(' > '), kind])).toEqual([
      ['a', 'suite'],
      ['a > b', 'test'],
      ['a > c', 'test'],
    ]);
  });
});

describe('parseDiagnostics', () => {
  it('reads tsc output, with messages over several lines', () => {
    const output = "src/a.ts(3,7): error TS2322: Type 'x' is not assignable.\n  Details here.\nFound 1 error.\n";
    expect(parseDiagnostics(output, '/root')).toEqual([
      {
        file: '/root/src/a.ts',
        line: 3,
        column: 7,
        code: 'TS2322',
        message: "Type 'x' is not assignable.\nDetails here.",
      },
    ]);
  });
});
