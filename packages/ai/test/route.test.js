const { routeOf } = require('../src/route');

const at = (path) => routeOf(`http://localhost:4321${path}`);

describe('routes', () => {
  it('reads ids, tokens and timestamps as placeholders, in the path and the query', () => {
    expect(at('/orders/42?t=1727780000')).toBe('/orders/:id?t=:id');
    expect(at('/orders/7?t=1727780999')).toBe(at('/orders/42?t=1727780000'));
    expect(at('/?list=0b6c7a3e-5f1d-4c2a-9e8b-1f2d3c4b5a69')).toBe('/?list=:id');
    expect(at('/users/507f1f77bcf86cd799439011')).toBe('/users/:id');
    expect(at('/invite/k3J9xQ2mP8vL5nR7tW1z')).toBe('/invite/:id');
    expect(at('/u/01ARZ3NDEKTSV4RRFFQ69G5FAV')).toBe('/u/:id');
    expect(at('/report?from=2026-10-06')).toBe('/report?from=:id');
  });

  it('keeps everything else: words, slugs, and which parameters there are', () => {
    expect(at('/products/summer-sneaker')).not.toBe(at('/products/winter-boot'));
    expect(at('/companies')).not.toBe(at('/companies?tab=notes'));
    expect(at('/settings?mode=safe')).not.toBe(at('/settings?mode=unsafe'));
    expect(at('/search?q=red+shoes')).toBe('/search?q=red shoes');
    expect(at('/a?b=1&a=x')).toBe(at('/a?a=x&b=2'));
  });

  it('leaves out the origin and the fragment', () => {
    expect(routeOf('https://preview-123.example.app/cart#summary')).toBe('/cart');
    expect(routeOf('about:blank')).toBe('about:blank');
    expect(at('/files/%E0%A4%A')).toBe('/files/%E0%A4%A');
  });
});
