// A small JSON Schema validator for toMatchSchema: the keywords API tests use (types, properties, required,
// additionalProperties, items, enum, const, lengths, ranges, pattern, formats, allOf/anyOf/oneOf/not, local $ref).
// Returns the problems found, each { path, message }, path a JSON pointer into the value ('' for the value itself).

const FORMATS = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  'date-time': /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})$/i,
  date: /^\d{4}-\d{2}-\d{2}$/,
  uri: /^[a-z][a-z\d+.-]*:[^\s]*$/i,
  ipv4: /^(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)$/,
};

function typeOf(value) {
  if (value === null) {
    return 'null';
  }
  if (Array.isArray(value)) {
    return 'array';
  }
  if (typeof value === 'number') {
    return Number.isInteger(value) ? 'integer' : 'number';
  }
  return typeof value;
}

const isType = (value, type) => {
  const actual = typeOf(value);
  return actual === type || (type === 'number' && actual === 'integer');
};

const escapePointer = (key) => String(key).replaceAll('~', '~0').replaceAll('/', '~1');

function deepEqual(a, b) {
  if (a === b) {
    return true;
  }
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) {
    return false;
  }
  if (Array.isArray(a) !== Array.isArray(b)) {
    return false;
  }
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((key) => deepEqual(a[key], b[key]));
}

const show = (value) => JSON.stringify(value) ?? String(value);

function resolveRef(ref, root) {
  if (!ref.startsWith('#')) {
    throw new Error(`toMatchSchema only follows local $refs (#/...): ${ref}`);
  }
  const target = ref
    .slice(1)
    .split('/')
    .filter(Boolean)
    .reduce((node, part) => node?.[part.replaceAll('~1', '/').replaceAll('~0', '~')], root);
  if (target === undefined) {
    throw new Error(`toMatchSchema can not find the $ref ${ref}`);
  }
  return target;
}

function validate(value, schema, root = schema, at = '') {
  if (schema === true || schema === undefined) {
    return [];
  }
  if (schema === false) {
    return [{ path: at, message: 'is not allowed' }];
  }
  if (schema.$ref) {
    return validate(value, resolveRef(schema.$ref, root), root, at);
  }
  const problems = [];
  const fail = (message, path = at) => problems.push({ path, message });
  const types = [schema.type ?? []].flat();
  if (schema.nullable && value === null) {
    return [];
  }
  if (types.length > 0 && !types.some((type) => isType(value, type))) {
    fail(`should be ${types.join(' or ')}, but is ${typeOf(value)}`);
    return problems;
  }
  if (schema.enum && !schema.enum.some((option) => deepEqual(option, value))) {
    fail(`should be one of ${schema.enum.map(show).join(', ')}, but is ${show(value)}`);
  }
  if ('const' in schema && !deepEqual(schema.const, value)) {
    fail(`should be ${show(schema.const)}, but is ${show(value)}`);
  }
  if (typeof value === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      fail(`should have at least ${schema.minLength} characters, but has ${value.length}`);
    }
    if (schema.maxLength !== undefined && value.length > schema.maxLength) {
      fail(`should have at most ${schema.maxLength} characters, but has ${value.length}`);
    }
    if (schema.pattern && !new RegExp(schema.pattern, 'u').test(value)) {
      fail(`should match ${schema.pattern}, but is ${show(value)}`);
    }
    if (schema.format && FORMATS[schema.format] && !FORMATS[schema.format].test(value)) {
      fail(`should be a ${schema.format}, but is ${show(value)}`);
    }
  }
  if (typeof value === 'number') {
    if (schema.minimum !== undefined && value < schema.minimum) {
      fail(`should be at least ${schema.minimum}, but is ${value}`);
    }
    if (schema.maximum !== undefined && value > schema.maximum) {
      fail(`should be at most ${schema.maximum}, but is ${value}`);
    }
    if (schema.exclusiveMinimum !== undefined && value <= schema.exclusiveMinimum) {
      fail(`should be more than ${schema.exclusiveMinimum}, but is ${value}`);
    }
    if (schema.exclusiveMaximum !== undefined && value >= schema.exclusiveMaximum) {
      fail(`should be less than ${schema.exclusiveMaximum}, but is ${value}`);
    }
    if (schema.multipleOf !== undefined && !Number.isInteger(value / schema.multipleOf)) {
      fail(`should be a multiple of ${schema.multipleOf}, but is ${value}`);
    }
  }
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) {
      fail(`should have at least ${schema.minItems} items, but has ${value.length}`);
    }
    if (schema.maxItems !== undefined && value.length > schema.maxItems) {
      fail(`should have at most ${schema.maxItems} items, but has ${value.length}`);
    }
    if (schema.uniqueItems && value.some((item, i) => value.findIndex((other) => deepEqual(other, item)) !== i)) {
      fail('should have unique items');
    }
    if (schema.items && !Array.isArray(schema.items)) {
      value.forEach((item, i) => problems.push(...validate(item, schema.items, root, `${at}/${i}`)));
    }
  }
  if (isType(value, 'object')) {
    (schema.required ?? [])
      .filter((key) => !Object.hasOwn(value, key))
      .forEach((key) => fail(`should have the property "${key}"`));
    const properties = schema.properties ?? {};
    Object.entries(value).forEach(([key, item]) => {
      const where = `${at}/${escapePointer(key)}`;
      if (Object.hasOwn(properties, key)) {
        problems.push(...validate(item, properties[key], root, where));
      } else if (schema.additionalProperties === false) {
        fail(`is not an allowed property`, where);
      } else if (typeof schema.additionalProperties === 'object') {
        problems.push(...validate(item, schema.additionalProperties, root, where));
      }
    });
  }
  (schema.allOf ?? []).forEach((part) => problems.push(...validate(value, part, root, at)));
  if (schema.anyOf && !schema.anyOf.some((part) => validate(value, part, root, at).length === 0)) {
    fail(`should match one of the anyOf schemas`);
  }
  if (schema.oneOf) {
    const matching = schema.oneOf.filter((part) => validate(value, part, root, at).length === 0).length;
    if (matching !== 1) {
      fail(`should match exactly one of the oneOf schemas, but matches ${matching}`);
    }
  }
  if (schema.not && validate(value, schema.not, root, at).length === 0) {
    fail('should not match the "not" schema');
  }
  return problems;
}

module.exports = { validate };
