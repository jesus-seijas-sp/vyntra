const fs = require('node:fs');
const path = require('node:path');
const { runFixture, copyFixture } = require('./helpers/run-fixture');

describe('babel-jest without a transform', () => {
  it('compiles the files of a Jest project with a Babel config, as Jest does', () => {
    const { statuses } = runFixture('babel-implicit');
    expect(statuses['runs through babel-jest without a transform in the config']).toBe('passed');
  });

  it('does not when the config turns transforms off', () => {
    const dir = copyFixture('babel-implicit');
    fs.writeFileSync(path.join(dir, 'jest.config.js'), 'module.exports = { transform: {} };\n');
    const { tests } = runFixture(dir);
    expect(tests['runs through babel-jest without a transform in the config'].errors[0].message).toBe(
      '__BABEL__ is not defined'
    );
  });
});
