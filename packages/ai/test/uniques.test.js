const { Uniques } = require('../src/uniques');

describe('unique() values', () => {
  const uniques = new Uniques();
  uniques.add('company', 'E2E 1727780000 "Acme"');

  it('reads as placeholders as written, URL-encoded and JSON-escaped', () => {
    expect(uniques.keyed('heading "E2E 1727780000 "Acme""')).toBe('heading "<unique:company>"');
    expect(uniques.keyed('/search?q=E2E+1727780000+%22Acme%22')).toBe('/search?q=<unique:company>');
    expect(uniques.keyed('/c/E2E%201727780000%20%22Acme%22')).toBe('/c/<unique:company>');
    expect(uniques.keyedValue({ value: 'E2E 1727780000 "Acme"' })).toEqual({ value: '<unique:company>' });
  });

  it('puts the values of this run back into a recording, and leaves a placeholder it has no value for', () => {
    const next = new Uniques();
    next.add('company', 'E2E 1727789999 "Acme"');
    expect(next.live({ value: '<unique:company>', other: '<unique:email>' })).toEqual({
      value: 'E2E 1727789999 "Acme"',
      other: '<unique:email>',
    });
  });
});
