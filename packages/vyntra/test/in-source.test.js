const { runFixture } = require('./helpers/run-fixture');

describe('in-source tests', () => {
  it.each([[['-w', '2']], [['-w', '1']], [['--pool', 'inline']]])(
    'runs the tests of source files, and only in their own file (%j)',
    (args) => {
      const { files, statuses } = runFixture('in-source', args);
      expect(statuses).toEqual({
        'math > adds': 'passed',
        'math > quadruples': 'passed',
        doubles: 'passed',
        shouts: 'passed',
        'imports a module with in-source tests without running them': 'passed',
      });
      const counts = Object.fromEntries(
        files.map((file) => [file.path.split('/').slice(-2).join('/'), file.tests.length])
      );
      expect(counts).toEqual({
        'src/math.js': 2,
        'src/double.js': 1,
        'src/typed.ts': 1,
        'in-source/uses-math.test.js': 1,
      });
    }
  );
});
