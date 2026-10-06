// The route of a page, as recordings know it: its path and query without the origin (the same on every machine,
// whichever port the app runs on) and without the fragment, with every value that names one record or one moment
// read as a placeholder. /orders/42?t=1727780000 and /orders/7?t=1727780999 are one route; /companies and
// /companies?tab=notes, or /products/summer-sneaker and /products/winter-boot, are not.

const PLACEHOLDER = ':id';

const ID_LIKE = [
  // A number: a record id, a page, a timestamp.
  /^\d+$/,
  // A UUID.
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  // A ULID.
  /^[0-9A-HJKMNP-TV-Z]{26}$/,
  // Hex of 8 or more characters with a digit: a hash, an object id, a cache buster.
  /^(?=[^\d]*\d)[0-9a-f]{8,}$/i,
  // An ISO date or date-time.
  /^\d{4}-\d{2}-\d{2}([T ][\d:.]+Z?)?$/,
];

// A token: 16 or more characters of letters, digits, - and _, with both letters and digits (a session or invite
// token, a base64url id). Words and slugs (summer-sneaker) have no digits, or are shorter.
const TOKEN = /^(?=.*\d)(?=.*[a-z])[\w-]{16,}$/i;

// A path segment as written, or as it is when it does not decode (a stray %).
function decoded(segment) {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

const isId = (value) => ID_LIKE.some((pattern) => pattern.test(value)) || TOKEN.test(value);
const normalize = (value) => (isId(value) ? PLACEHOLDER : value);

// The route of a URL; a URL that is not http or https (about:blank, a data: page) is its own route.
function routeOf(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }
  if (!parsed.protocol.startsWith('http')) {
    return url;
  }
  const path = parsed.pathname
    .split('/')
    .map((segment) => normalize(decoded(segment)))
    .join('/');
  // Parameters in a fixed order: ?b=1&a=2 and ?a=2&b=1 are one route.
  const query = [...parsed.searchParams]
    .map(([key, value]) => `${key}=${normalize(value)}`)
    .sort()
    .join('&');
  return query ? `${path}?${query}` : path;
}

module.exports = { routeOf };
