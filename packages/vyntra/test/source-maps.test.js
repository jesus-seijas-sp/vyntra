const { runFixture } = require('./helpers/run-fixture');
const { registerCompiledCode, mapStack } = require('../src/source-maps');

const lineOf = (test, file) => {
  const frame = test.errors[0].stack.split('\n').find((line) => line.includes(file));
  return /:(\d+):(\d+)\)?$/.exec(frame).slice(1).map(Number);
};

describe('source maps', () => {
  it.each([['threads'], ['forks']])('reports frames of compiled files at their lines as written (%s)', (pool) => {
    const { tests } = runFixture('sourcemaps', ['--pool', pool, '-w', '2']);
    expect(lineOf(tests['total > adds the prices'], 'cart.test.ts')).toEqual([9, 34]);
    expect(lineOf(tests['total > refuses a discount over 100'], 'cart.ts')).toEqual([10, 11]);
    expect(lineOf(tests['total > refuses a discount over 100'], 'cart.test.ts')).toEqual([13, 5]);
    expect(lineOf(tests['fails on its fourth line'], 'second.test.ts')).toEqual([4, 17]);
  });

  it('reads the map a Jest transformer returns beside the code', () => {
    const { tests } = runFixture('sourcemaps-jest');
    expect(lineOf(tests['a transformed file > fails on its seventh line'], 'map.test.js')).toEqual([6, 24]);
  });

  it('leaves frames of files it has no map for as they are', () => {
    const map = Buffer.from(JSON.stringify({ version: 3, sources: ['/x.js'], names: [], mappings: ';;AAAA' })).toString(
      'base64'
    );
    registerCompiledCode((file) =>
      file === '/x.js' ? `a\nb\nc\n//# sourceMappingURL=data:application/json;base64,${map}` : null
    );
    expect(mapStack('Error: x\n    at f (/x.js:3:7)\n    at g (file:///x.js?vyntra=2:3:1)\n    at /y.js:3:7')).toBe(
      'Error: x\n    at f (/x.js:1:7)\n    at g (file:///x.js?vyntra=2:1:1)\n    at /y.js:3:7'
    );
  });
});
