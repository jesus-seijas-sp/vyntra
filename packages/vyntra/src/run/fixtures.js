// vitest's test.extend() fixtures. A fixture is a value, or an async function (context, use) that sets something
// up, hands it to the test with `await use(value)` and tears it down when use() returns. Only the fixtures a test
// destructures are set up (plus the auto ones), each after the fixtures it destructures itself.
//
// A fixture's scope is the test (the default), the file ({ scope: 'file' }) or the worker ({ scope: 'worker' }): a
// browser, a started server, set up once and shared by every test of the file or of the worker. An option
// ([default, { option: true }]) takes its value from the config's `use`, whose values are fixtures too.

const { SharedScope, runTeardowns } = require('./shared-scope');

// Names destructured by the first parameter, or null when they can not be known (no destructuring, or ...rest).
function destructuredNames(fn) {
  const match = /^(?:async\s*)?(?:function\b[^(]*)?\(\s*\{([^}]*)\}/.exec(Function.prototype.toString.call(fn));
  if (!match || match[1].includes('...')) {
    return null;
  }
  return match[1]
    .split(',')
    .map((part) => part.split(/[:=]/)[0].trim())
    .filter(Boolean);
}

// [value, { auto: true }] is a fixture with options.
function parseFixture(definition) {
  const withOptions =
    Array.isArray(definition) &&
    definition.length === 2 &&
    typeof definition[1] === 'object' &&
    definition[1] !== null &&
    !Array.isArray(definition[1]);
  return withOptions ? { value: definition[0], options: definition[1] } : { value: definition, options: {} };
}

// Runs a fixture function until it calls use(); the rest of it, run later, is the teardown added to `teardowns`.
async function runSetup(setup, context, teardowns) {
  const provided = Promise.withResolvers();
  const released = Promise.withResolvers();
  const running = Promise.resolve(
    setup(context, async (value) => {
      provided.resolve({ value });
      await released.promise;
    })
  );
  const first = await Promise.race([provided.promise, running.then(() => null)]);
  teardowns.push(async () => {
    released.resolve();
    await running;
  });
  return first?.value;
}

const scopes = { file: new SharedScope(), worker: new SharedScope() };

// Ends the shared fixtures of a scope ('file' after each file, 'worker' when the worker finishes); returns the errors
// of their teardowns.
const teardownScope = (scope) => scopes[scope].teardown();

const SCOPES = ['test', 'file', 'worker'];

class FixtureSet {
  // fixtures: the test's (test.extend), use: the config's options, builtins: those vyntra provides (api, server).
  constructor(fixtures, context, { use = {}, builtins = {} } = {}) {
    const options = Object.fromEntries(Object.entries(use).map(([key, value]) => [key, [value, { option: true }]]));
    this.fixtures = { ...builtins, ...options };
    Object.entries(fixtures ?? {}).forEach(([key, definition]) => {
      // A project's `use` sets an option; the test.extend() default applies when it does not.
      const option = parseFixture(definition).options.option && Object.hasOwn(use, key);
      if (!option) {
        this.fixtures[key] = definition;
      }
    });
    // A test whose fixtures can not be told from its parameters gets those it declared, not every built-in one.
    this.declared = Object.keys(fixtures ?? {});
    this.context = context;
    this.ready = new Set();
    this.pending = new Set();
    this.teardowns = [];
  }

  // A value is the same for every test: it lives as long as the worker.
  scopeOf(key) {
    const { value, options } = parseFixture(this.fixtures[key]);
    const scope = options.scope ?? (typeof value === 'function' ? 'test' : 'worker');
    if (!SCOPES.includes(scope)) {
      throw new Error(`Fixture ${key} has an unknown scope "${scope}" (test, file or worker)`);
    }
    return scope;
  }

  // The fixtures a fixture function destructures, set up first; a shared fixture can only use fixtures that live
  // as long as it does.
  async dependencies(key, fn, scope) {
    const named = destructuredNames(fn);
    const rank = (dep) => SCOPES.indexOf(this.scopeOf(dep));
    // Not destructured: a test fixture gets every fixture declared with it, as before scopes; a shared one, none
    // (vitest asks fixtures to destructure what they use).
    const deps = (named ?? (scope === 'test' ? this.declared : [])).filter(
      (dep) => dep !== key && Object.hasOwn(this.fixtures, dep)
    );
    const shorter = deps.find((dep) => rank(dep) < SCOPES.indexOf(scope));
    if (shorter) {
      throw new Error(`The ${scope} fixture ${key} can not use the ${this.scopeOf(shorter)} fixture ${shorter}`);
    }
    await deps.reduce((prev, dep) => prev.then(() => this.init(dep)), Promise.resolve());
    return Object.fromEntries(deps.map((dep) => [dep, this.context[dep]]));
  }

  async init(key) {
    if (this.ready.has(key) || !Object.hasOwn(this.fixtures, key)) {
      return;
    }
    if (this.pending.has(key)) {
      throw new Error(`Circular fixture dependency: ${key}`);
    }
    this.pending.add(key);
    const { value } = parseFixture(this.fixtures[key]);
    const scope = this.scopeOf(key);
    if (typeof value !== 'function') {
      this.context[key] = value;
    } else if (scope === 'test') {
      await this.dependencies(key, value, scope);
      this.context[key] = await runSetup(value, this.context, this.teardowns);
    } else {
      this.context[key] = await scopes[scope].get(key, value, async (teardowns) =>
        runSetup(value, await this.dependencies(key, value, scope), teardowns)
      );
    }
    this.pending.delete(key);
    this.ready.add(key);
  }

  async setup(testFn) {
    const autos = Object.keys(this.fixtures).filter((key) => parseFixture(this.fixtures[key]).options.auto);
    const used = destructuredNames(testFn) ?? this.declared;
    await [...autos, ...used].reduce((prev, key) => prev.then(() => this.init(key)), Promise.resolve());
  }

  teardown() {
    return runTeardowns(this.teardowns);
  }
}

module.exports = { FixtureSet, teardownScope };
