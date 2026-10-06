const { inspect } = require('node:util');
const { registerSecret, taint } = require('vyntra/engine');

// The values of the handles, out of reach of anything that holds a handle.
const values = new WeakMap();

// A secret a test hands to an agent step (a password, an API key): it has a name and no readable value. The model
// sees only <secret:NAME> and types it with type_secret, the runner fills the field, and the value is hidden from
// everything the AI steps send or write (prompts, recordings, failure pages).
class Secret {
  #name;

  constructor(name, value) {
    this.#name = name;
    values.set(this, value);
  }

  get name() {
    return this.#name;
  }

  toString() {
    return `<secret:${this.#name}>`;
  }

  toJSON() {
    return this.toString();
  }

  [inspect.custom]() {
    return this.toString();
  }
}

const isSecret = (value) => value instanceof Secret;

// secret('ADMIN_PASSWORD') takes the value of that environment variable; secret('admin', value) takes the value given
// (from a vault, say). Its value is hidden from the AI steps' output from now on, in this worker.
function secret(name, value = process.env[name]) {
  if (typeof name !== 'string' || !/^[\w.-]+$/.test(name)) {
    throw new TypeError(`A secret's name is letters, digits, "_", "." or "-": ${name}`);
  }
  if (value === undefined || value === '') {
    throw new Error(`The secret ${name} has no value: set the ${name} environment variable, or pass the value`);
  }
  registerSecret(name, String(value));
  return new Secret(name, String(value));
}

// The value, for the runner's own fills only.
function reveal(handle) {
  return values.get(handle);
}

// Types a secret into a field the test chose (a Playwright locator): the value never appears in the test's code, and
// the attempt keeps no screenshot or trace afterwards.
async function fillSecret(locator, handle, options) {
  if (!isSecret(handle)) {
    throw new TypeError('fillSecret takes a secret(...) handle');
  }
  taint();
  await locator.fill(reveal(handle), options);
}

module.exports = { secret, isSecret, reveal, fillSecret };
