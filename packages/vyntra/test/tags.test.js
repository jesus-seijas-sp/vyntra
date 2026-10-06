const { runFixture } = require('./helpers/run-fixture');

const ran = (report) =>
  Object.entries(report.statuses)
    .filter(([, status]) => status !== 'skipped')
    .map(([name]) => name)
    .sort();

describe('tags, name filters and repeats', () => {
  it('runs the tests with one of the tags, inherited from their describe blocks', () => {
    expect(ran(runFixture('tags', ['--tag', 'billing']))).toEqual([
      'billing > downgrades the plan',
      'billing > upgrades the plan',
    ]);
    expect(ran(runFixture('tags', ['--tag', 'slow,auth']))).toEqual(['billing > upgrades the plan', 'signs in']);
  });

  it('leaves out the tests with an excluded tag, whatever else selects them', () => {
    expect(ran(runFixture('tags', ['--tag', 'billing', '--exclude-tag', 'slow']))).toEqual([
      'billing > downgrades the plan',
    ]);
  });

  it('leaves out the tests whose name matches --grep-invert, and --grep is -t', () => {
    expect(ran(runFixture('tags', ['--grep-invert', 'plan|passes']))).toEqual(['lists the orders', 'signs in']);
    expect(ran(runFixture('tags', ['--grep', 'orders']))).toEqual(['lists the orders']);
  });

  it('runs every test n times under --repeat-each, failing a test that fails once', () => {
    expect(runFixture('tags').statuses['passes twice']).toBe('passed');
    const repeated = runFixture('tags', ['--repeat-each', '3']);
    expect(repeated.statuses['passes twice']).toBe('failed');
    expect(repeated.tests['passes twice'].errors[0].message).toBe('the third run failed');
    expect(repeated.statuses['lists the orders']).toBe('passed');
  });
});
