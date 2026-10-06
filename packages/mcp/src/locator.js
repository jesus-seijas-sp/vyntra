// A Playwright locator written as code ("getByRole('button', { name: 'Add' }).first()"), read without running it:
// a chain of the locator methods below, with literal arguments (strings, numbers, booleans, regular expressions,
// plain objects of those). What an agent asks for is never evaluated.

const METHODS = new Set([
  'locator',
  'getByRole',
  'getByText',
  'getByLabel',
  'getByPlaceholder',
  'getByAltText',
  'getByTitle',
  'getByTestId',
  'first',
  'last',
  'nth',
  'filter',
]);

class Reader {
  constructor(source) {
    this.source = source;
    this.at = 0;
  }

  fail(what) {
    throw new Error(`Can not read the locator at ${this.at}: ${what} (in ${this.source})`);
  }

  space() {
    while (/\s/.test(this.source[this.at] ?? '')) {
      this.at += 1;
    }
  }

  take(text) {
    this.space();
    if (this.source.startsWith(text, this.at)) {
      this.at += text.length;
      return true;
    }
    return false;
  }

  expect(text) {
    if (!this.take(text)) {
      this.fail(`expected ${text}`);
    }
  }

  name() {
    this.space();
    const match = /^[A-Za-z_$][\w$]*/.exec(this.source.slice(this.at));
    if (!match) {
      this.fail('expected a name');
    }
    this.at += match[0].length;
    return match[0];
  }

  string() {
    const quote = this.source[this.at];
    let value = '';
    this.at += 1;
    while (this.at < this.source.length && this.source[this.at] !== quote) {
      if (this.source[this.at] === '\\') {
        this.at += 1;
      }
      value += this.source[this.at];
      this.at += 1;
    }
    this.expect(quote);
    return value;
  }

  regex() {
    const match = /^\/((?:\\.|\[(?:\\.|[^\]])*\]|[^/\\\n])+)\/([dgimsuy]*)/.exec(this.source.slice(this.at));
    if (!match) {
      this.fail('expected a regular expression');
    }
    this.at += match[0].length;
    return new RegExp(match[1], match[2]);
  }

  object() {
    const value = {};
    this.expect('{');
    while (!this.take('}')) {
      this.space();
      const key = /['"]/.test(this.source[this.at]) ? this.string() : this.name();
      this.expect(':');
      value[key] = this.value();
      if (!this.take(',')) {
        this.expect('}');
        break;
      }
    }
    return value;
  }

  value() {
    this.space();
    const char = this.source[this.at];
    if (char === "'" || char === '"' || char === '`') {
      return this.string();
    }
    if (char === '/') {
      return this.regex();
    }
    if (char === '{') {
      return this.object();
    }
    const number = /^-?\d+(\.\d+)?/.exec(this.source.slice(this.at));
    if (number) {
      this.at += number[0].length;
      return Number(number[0]);
    }
    const word = this.name();
    if (word === 'true' || word === 'false') {
      return word === 'true';
    }
    return this.fail(`unexpected ${word}`);
  }

  call() {
    const method = this.name();
    if (!METHODS.has(method)) {
      this.fail(`${method} is not a locator method (${[...METHODS].join(', ')})`);
    }
    this.expect('(');
    const args = [];
    while (!this.take(')')) {
      args.push(this.value());
      if (!this.take(',')) {
        this.expect(')');
        break;
      }
    }
    return { method, args };
  }
}

// [{ method, args }] of the chain; a leading "page." is allowed.
function parseLocator(source) {
  const reader = new Reader(
    String(source)
      .trim()
      .replace(/^page\s*\./, '')
  );
  const calls = [reader.call()];
  while (reader.take('.')) {
    calls.push(reader.call());
  }
  reader.space();
  if (reader.at < reader.source.length) {
    reader.fail('unexpected text after the locator');
  }
  return calls;
}

// The locator the chain describes, on a Playwright page.
const buildLocator = (page, calls) => calls.reduce((target, { method, args }) => target[method](...args), page);

module.exports = { parseLocator, buildLocator };
