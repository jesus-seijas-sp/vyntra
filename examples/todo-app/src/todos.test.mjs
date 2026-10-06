import { cleanTitle, summary } from './todos.mjs';

describe('cleanTitle', () => {
  it('trims and collapses spaces', () => {
    expect(cleanTitle('  Buy   milk ')).toBe('Buy milk');
  });

  it('refuses an empty title', () => {
    expect(() => cleanTitle('   ')).toThrow('A todo needs a title');
  });
});

describe('summary', () => {
  it('counts what is left', () => {
    expect(summary([{ done: true }, { done: false }])).toBe('1 of 2 left');
    expect(summary([])).toBe('Nothing to do');
  });
});
