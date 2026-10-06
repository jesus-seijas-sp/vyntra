const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { copyFixture } = require('./helpers/run-fixture');
const { functionStarts } = require('../src/coverage/untested');

const BIN = path.join(__dirname, '..', 'bin', 'vyntra.js');

function coverageOf(config, fixture = 'coverage', args = []) {
  const dir = copyFixture(fixture);
  if (config) {
    fs.writeFileSync(path.join(dir, 'vyntra.config.js'), `module.exports = ${JSON.stringify(config)};\n`);
  }
  const { stdout } = spawnSync(process.execPath, [BIN, '--root', dir, '--no-color', '--coverage', ...args], {
    encoding: 'utf8',
    env: { ...process.env, CI: '', GITHUB_ACTIONS: '' },
  });
  const rows = Object.fromEntries(
    stdout
      .split('\n')
      .map((line) => line.split('|').map((cell) => cell.trim()))
      .filter((cells) => cells.length >= 5 && /\.js|\.ts/.test(cells[0]))
      .map(([file, ...cells]) => [file, cells])
  );
  return { rows, lcov: fs.readFileSync(path.join(dir, 'coverage', 'lcov.info'), 'utf8') };
}

describe('coverage of files no test loads', () => {
  it('reports them at zero when the config says which files to cover', () => {
    const { rows, lcov } = coverageOf({ collectCoverageFrom: ['src/**'] });
    expect(Object.keys(rows).sort()).toEqual(['src/math.js', 'src/unused.js']);
    // statements, branches, functions, lines, uncovered lines
    expect(rows['src/unused.js']).toEqual(['0.00', '100.00', '0.00', '0.00', '2-8']);
    expect(lcov).toMatch(/SF:.*src\/unused\.js\n(?:FN.*\n)+FNF:2\nFNH:0\n/);
  });

  it('reports only the files tests loaded when it does not', () => {
    expect(Object.keys(coverageOf().rows)).toEqual(['src/math.js']);
  });
});

describe('coverage of compiled files', () => {
  it('counts the lines of the source, not of the compiled code', () => {
    // The fixture's compiler drops blank and comment lines: the throw on line 10 is line 3 of what ran.
    const { rows, lcov } = coverageOf(null, 'sourcemaps', ['cart.test.ts', '-t', 'adds']);
    expect(rows['cart.ts']).toEqual(['75.00', '0.00', '100.00', '75.00', '10']);
    // The compiled module, a function over the whole script, is not one of the file's functions.
    expect(lcov.match(/^FN:.*$/gm)).toEqual(['FN:5,total', 'FN:12,(anonymous)']);
  });
});

describe('functionStarts', () => {
  it('finds functions in code, not in strings or comments', () => {
    const source = "// a function => in a comment\nconst f = () => 1;\nfunction g() {}\nconst s = 'function';\n";
    expect(functionStarts(source)).toEqual([source.indexOf('=> 1'), source.indexOf('function g')]);
  });
});
