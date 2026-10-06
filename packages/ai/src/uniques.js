// The unique() values of one test (see unique.js), and how keys and recordings see them: as <unique:name>.

const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// The unique values of one test, by the name of the param that carried them.
class Uniques {
  #values = new Map();

  add(name, value) {
    this.#values.set(name, value);
  }

  // Text with the values as placeholders: as written, URL-encoded (%20 or + for spaces) and JSON-escaped.
  keyed(text) {
    if (typeof text !== 'string' || this.#values.size === 0) {
      return text;
    }
    return [...this.#values]
      .sort(([, a], [, b]) => b.length - a.length)
      .reduce((result, [name, value]) => {
        const encoded = encodeURIComponent(value);
        const forms = new Set([value, encoded, encoded.replace(/%20/g, '+'), JSON.stringify(value).slice(1, -1)]);
        return result.replace(new RegExp([...forms].map(escapeRegExp).join('|'), 'g'), `<unique:${name}>`);
      }, text);
  }

  // A recorded value (an action, an effect) with this run's values in place of the placeholders, as JSON writes
  // them; a placeholder this run has no value for stays.
  live(value) {
    const text = JSON.stringify(value).replace(/<unique:(\w+)>/g, (whole, name) =>
      this.#values.has(name) ? JSON.stringify(this.#values.get(name)).slice(1, -1) : whole
    );
    return JSON.parse(text);
  }

  // A value to record, with this run's values as placeholders.
  keyedValue(value) {
    return JSON.parse(this.keyed(JSON.stringify(value)));
  }
}

module.exports = { Uniques };
