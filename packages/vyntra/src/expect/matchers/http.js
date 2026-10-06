const { equals } = require('../equals');
const { printReceived, printExpected } = require('../context');
const { validate } = require('../../api/schema');

const MAX_PROBLEMS = 10;
const EXCERPT = 500;

const isResponse = (value) => typeof value?.status === 'number' && value.headers !== undefined;

// The request a response answered, and the start of its body: what a failing status needs to be understood.
function describeResponse(response) {
  const where = response.method && response.url ? `${response.method} ${response.url}` : null;
  const text = typeof response.text === 'string' ? response.text : null;
  const body = text ? `Body: ${text.length > EXCERPT ? `${text.slice(0, EXCERPT)}…` : text}` : null;
  return [where, body].filter(Boolean).join('\n');
}

// A status (201), or a class of them ('2xx').
function statusMatches(status, expected) {
  if (typeof expected === 'string' && /^[1-5]xx$/i.test(expected)) {
    return Math.floor(status / 100) === Number(expected[0]);
  }
  return status === expected;
}

function toHaveStatus(received, expected) {
  if (!isResponse(received)) {
    throw new TypeError(`toHaveStatus expects a response (with a status), not ${printReceived(received)}`);
  }
  return {
    pass: statusMatches(received.status, expected),
    message: () =>
      `${this.hint('toHaveStatus', 'status')}\n\n${this.not('Expected status:')} ${printExpected(expected)}\nReceived status: ${printReceived(received.status)}\n${describeResponse(received)}`,
  };
}

function headerOf(headers, name) {
  if (typeof headers?.get === 'function') {
    return headers.get(name) ?? undefined;
  }
  const key = Object.keys(headers ?? {}).find((one) => one.toLowerCase() === name.toLowerCase());
  return key === undefined ? undefined : headers[key];
}

function toHaveHeader(received, name, expected) {
  const headers = isResponse(received) ? received.headers : received;
  const value = headerOf(headers, name);
  let pass = value !== undefined;
  if (pass && expected !== undefined) {
    pass = expected instanceof RegExp ? expected.test(value) : equals(value, expected);
  }
  const wanted = expected === undefined ? '' : ` ${printExpected(expected)}`;
  return {
    pass,
    message: () =>
      `${this.hint('toHaveHeader', 'name')}\n\n${this.not('Expected header:')} ${name}${wanted}\nReceived:        ${value === undefined ? 'no such header' : printReceived(value)}`,
  };
}

// A value, or a response's body, against a JSON Schema.
function toMatchSchema(received, schema) {
  const value = received?.isApiResponse ? received.body : received;
  const problems = validate(value, schema);
  const listed = problems
    .slice(0, MAX_PROBLEMS)
    .map(({ path, message }) => `  ${path || '(the value)'} ${message}`)
    .join('\n');
  const more = problems.length > MAX_PROBLEMS ? `\n  … and ${problems.length - MAX_PROBLEMS} more` : '';
  return {
    pass: problems.length === 0,
    message: () =>
      problems.length > 0
        ? `${this.hint('toMatchSchema', 'schema')}\n\nThe value does not match the schema:\n${listed}${more}`
        : `${this.hint('toMatchSchema', 'schema')}\n\nThe value matches the schema: ${printReceived(value)}`,
  };
}

module.exports = { toHaveStatus, toHaveHeader, toMatchSchema };
