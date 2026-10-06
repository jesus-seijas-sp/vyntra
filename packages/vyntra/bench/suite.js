// A synthetic unit test suite, written to a folder: the workload of the benchmark gate. Generated the same way every
// time (a seeded generator), self-contained (no dependencies, no node_modules, so no caches), and shaped like real
// suites: test files importing chains of project modules, with matchers on nested data, mock functions, module
// mocks, fake timers and async tests.

const fs = require('node:fs');
const path = require('node:path');

// mulberry32: small, fast and the same everywhere.
function random(seed) {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0; // eslint-disable-line no-bitwise
    let t = Math.imul(state ^ (state >>> 15), 1 | state); // eslint-disable-line no-bitwise
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t); // eslint-disable-line no-bitwise
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296; // eslint-disable-line no-bitwise
  };
}

const MODULES = 60;
const FILES = 200;
const TESTS = 15;

function moduleSource(index, next) {
  const imports = Array.from({ length: Math.min(3, MODULES - index - 1) }, (_, i) => index + 1 + i)
    .filter(() => next() < 0.6)
    .map((dep) => `const m${dep} = require('./m${dep}');`);
  return `${imports.join('\n')}
function build${index}(n) {
  return { id: ${index}, n, items: Array.from({ length: n % 7 }, (_, i) => ({ i, label: 'item-' + i })) };
}
function score${index}(value) {
  ${imports.length > 0 ? `return value * ${index + 1} + ${imports.map((line) => `${line.match(/m\d+/)[0]}.score${line.match(/m(\d+)/)[1]}(1)`).join(' + ')};` : `return value * ${index + 1};`}
}
function check${index}(value) {
  if (typeof value !== 'number') {
    throw new TypeError('module ${index} takes numbers');
  }
  return value >= 0;
}
module.exports = { build${index}, score${index}, check${index} };
`;
}

function testSource(index, next) {
  const target = Math.floor(next() * MODULES);
  const mocked = next() < 0.2 ? (target + 1) % MODULES : null;
  const timers = next() < 0.25;
  const tests = Array.from({ length: TESTS }, (_, i) => {
    switch ((index + i) % 6) {
      case 0:
        return `  it('builds ${i}', () => {
    expect(m.build${target}(${i})).toEqual({ id: ${target}, n: ${i}, items: Array.from({ length: ${i % 7} }, (_, k) => ({ i: k, label: 'item-' + k })) });
  });`;
      case 1:
        return `  it('scores ${i}', () => {
    expect(m.score${target}(${i})).toBeGreaterThanOrEqual(${i * (target + 1)});
  });`;
      case 2:
        return `  it('refuses what is not a number ${i}', () => {
    expect(() => m.check${target}('${i}')).toThrow(TypeError);
    expect(m.check${target}(${i})).toBe(true);
  });`;
      case 3:
        return `  it('calls back ${i}', () => {
    const callback = vi.fn((value) => value * 2);
    [${i}, ${i + 1}, ${i + 2}].forEach(callback);
    expect(callback).toHaveBeenCalledTimes(3);
    expect(callback).toHaveBeenLastCalledWith(${i + 2}, 2, [${i}, ${i + 1}, ${i + 2}]);
    expect(callback.mock.results.map((r) => r.value)).toEqual([${i * 2}, ${(i + 1) * 2}, ${(i + 2) * 2}]);
  });`;
      case 4:
        return timers
          ? `  it('waits ${i}', () => {
    vi.useFakeTimers();
    const done = vi.fn();
    setTimeout(done, ${100 + i});
    vi.advanceTimersByTime(${100 + i});
    expect(done).toHaveBeenCalled();
    vi.useRealTimers();
  });`
          : `  it('matches ${i}', () => {
    expect(m.build${target}(${i + 3})).toMatchObject({ id: ${target}, items: expect.any(Array) });
  });`;
      default:
        return `  it('resolves ${i}', async () => {
    await expect(Promise.resolve(m.score${target}(${i}))).resolves.toBe(m.score${target}(${i}));
  });`;
    }
  });
  return `${mocked !== null ? `vi.mock('../src/m${mocked}', () => ({ build${mocked}: () => ({}), score${mocked}: () => 0, check${mocked}: () => true }));\n` : ''}const m = require('../src/m${target}');

describe('file ${index}', () => {
${tests.join('\n\n')}
});
`;
}

// Writes the suite into dir (emptied first); returns { files, tests }.
function writeSuite(dir, seed = 42) {
  const next = random(seed);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'test'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'package.json'), '{ "name": "vyntra-bench-suite", "private": true }\n');
  for (let i = 0; i < MODULES; i += 1) {
    fs.writeFileSync(path.join(dir, 'src', `m${i}.js`), moduleSource(i, next));
  }
  for (let i = 0; i < FILES; i += 1) {
    fs.writeFileSync(path.join(dir, 'test', `t${i}.test.js`), testSource(i, next));
  }
  return { files: FILES, tests: FILES * TESTS };
}

module.exports = { writeSuite };
