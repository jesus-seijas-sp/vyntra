const { runFixture } = require('./helpers/run-fixture');
const { callSync } = require('../src/sync-bridge');

describe('hooks that are async', () => {
  it.each([['threads'], ['forks']])("runs Vite plugins' resolveId, load and async transforms (%s)", (pool) => {
    const { statuses } = runFixture('plugins-async', ['--pool', pool, '-w', '2']);
    expect(statuses).toEqual({
      'imports a module a plugin resolves and loads': 'passed',
      'has its code through an async transform': 'passed',
    });
  });

  it('runs a Jest transformer that only has processAsync', () => {
    const { statuses } = runFixture('jest-async-transform');
    expect(statuses['runs through a transformer that only has processAsync']).toBe('passed');
  });

  it('gives back what the helper thread throws', () => {
    expect(() => callSync('nope')).toThrow();
  });
});
