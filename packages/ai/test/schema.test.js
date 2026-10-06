const { problemOf } = require('../src/schema');

describe('schema checks', () => {
  it('accepts values that fit', () => {
    const order = {
      type: 'object',
      properties: { id: { type: 'integer' }, items: { type: 'array', items: { type: 'string' } } },
      required: ['id'],
    };
    expect(problemOf(order, { id: 42, items: ['milk'] })).toBeNull();
    expect(problemOf({ type: ['string', 'null'] }, null)).toBeNull();
    expect(problemOf({ type: 'number' }, 3)).toBeNull();
  });

  it('says how a value breaks its schema', () => {
    expect(problemOf({ type: 'integer' }, 'one')).toBe('the value is string, not integer');
    expect(problemOf({ type: 'integer' }, 1.5)).toBe('the value is a number, not integer');
    expect(problemOf({ enum: ['Free', 'Pro'] }, 'Team')).toBe('the value is "Team", not one of "Free", "Pro"');
    expect(problemOf({ type: 'array', items: { type: 'string' } }, ['a', 2])).toBe(
      'the value[1] is a number, not string'
    );
    expect(problemOf({ type: 'object', required: ['id'] }, {})).toBe('the value lacks id');
    expect(problemOf({ type: 'string', pattern: '^[0-9]+$' }, 'n/a')).toBe('the value does not match ^[0-9]+$');
    expect(problemOf({ type: 'number', minimum: 0 }, -1)).toBe('the value is below 0');
  });
});
