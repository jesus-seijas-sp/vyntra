// A JSON Schema check for what the AI steps receive: the input of a tool call, the value extract reads off a page. It
// covers the keywords such schemas use (type, enum, const, properties, required, additionalProperties, items,
// anyOf, oneOf, minimum, maximum, minLength, maxLength, pattern, minItems, maxItems); others are not checked.

const typeOf = (value) => {
  if (value === null) {
    return 'null';
  }
  if (Array.isArray(value)) {
    return 'array';
  }
  if (Number.isInteger(value)) {
    return 'integer';
  }
  return typeof value;
};

const fitsType = (type, actual) => type === actual || (type === 'number' && actual === 'integer');

const show = (value) => JSON.stringify(value);

// The first way a value breaks its schema, as a sentence about `where`, or null when it does not.
function problemOf(schema, value, where = 'the value') {
  if (schema === true || schema === undefined || schema === null) {
    return null;
  }
  const alternatives = schema.anyOf ?? schema.oneOf;
  if (alternatives) {
    return alternatives.some((option) => problemOf(option, value, where) === null)
      ? null
      : `${where} is none of the forms it may take`;
  }
  const actual = typeOf(value);
  if (schema.type !== undefined) {
    const types = [schema.type].flat();
    if (!types.some((type) => fitsType(type, actual))) {
      const shown = actual === 'integer' || actual === 'number' ? 'a number' : actual;
      return `${where} is ${shown}, not ${types.join(' or ')}`;
    }
  }
  if (schema.const !== undefined && show(schema.const) !== show(value)) {
    return `${where} is ${show(value)}, not ${show(schema.const)}`;
  }
  if (schema.enum && !schema.enum.some((option) => show(option) === show(value))) {
    return `${where} is ${show(value)}, not one of ${schema.enum.map(show).join(', ')}`;
  }
  if (actual === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      return `${where} is shorter than ${schema.minLength} characters`;
    }
    if (schema.maxLength !== undefined && value.length > schema.maxLength) {
      return `${where} is longer than ${schema.maxLength} characters`;
    }
    if (schema.pattern !== undefined && !new RegExp(schema.pattern, 'u').test(value)) {
      return `${where} does not match ${schema.pattern}`;
    }
  }
  if (actual === 'number' || actual === 'integer') {
    if (schema.minimum !== undefined && value < schema.minimum) {
      return `${where} is below ${schema.minimum}`;
    }
    if (schema.maximum !== undefined && value > schema.maximum) {
      return `${where} is above ${schema.maximum}`;
    }
  }
  if (actual === 'array') {
    if (schema.minItems !== undefined && value.length < schema.minItems) {
      return `${where} has fewer than ${schema.minItems} items`;
    }
    if (schema.maxItems !== undefined && value.length > schema.maxItems) {
      return `${where} has more than ${schema.maxItems} items`;
    }
    if (schema.items) {
      return value.map((item, i) => problemOf(schema.items, item, `${where}[${i}]`)).find(Boolean) ?? null;
    }
  }
  if (actual === 'object') {
    const properties = schema.properties ?? {};
    const extra = Object.keys(value).find((key) => !Object.hasOwn(properties, key));
    if (extra && schema.additionalProperties === false) {
      return `${where} has ${extra}, which it does not take`;
    }
    const missing = (schema.required ?? []).find((key) => !Object.hasOwn(value, key));
    if (missing) {
      return `${where} lacks ${missing}`;
    }
    return (
      Object.entries(value)
        .filter(([key]) => Object.hasOwn(properties, key))
        .map(([key, field]) => problemOf(properties[key], field, `${where}.${key}`))
        .find(Boolean) ?? null
    );
  }
  return null;
}

module.exports = { problemOf };
