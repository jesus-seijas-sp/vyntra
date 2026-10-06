const Module = require('node:module');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

// Test environments of a project's own, named by testEnvironment (Jest), environment (vitest) or a file's
// @jest-environment / @vitest-environment comment: a path, or a package (jest-environment-<name>,
// vitest-environment-<name>). Set up for each test file and torn down after it, as Jest and vitest do.
//
// - vitest's: an object { name, setup(global, options) } whose setup returns { teardown(global) }. It gets the real
//   global object, which is where vyntra runs tests.
// - Jest's: a class (usually extending NodeEnvironment or JSDOMEnvironment) whose `this.global` Jest runs tests in,
//   as a VM context. vyntra runs tests in the worker's global instead: it installs the class's base environment
//   (node, or vyntra's jsdom) and copies in the globals the class adds, the names its global has that a plain
//   instance of its base class does not.

const BUILT_IN = new Set(['node', 'jsdom', 'happy-dom']);
const BASES = { NodeEnvironment: 'node', JSDOMEnvironment: 'jsdom', TestEnvironment: null };

const isCustom = (name) => typeof name === 'string' && !BUILT_IN.has(name);

function resolveModule(name, rootDir) {
  const require = Module.createRequire(path.join(rootDir, 'package.json'));
  const candidates =
    name.startsWith('.') || path.isAbsolute(name)
      ? [path.resolve(rootDir, name)]
      : [name, `jest-environment-${name}`, `vitest-environment-${name}`];
  const found = candidates.reduce((result, candidate) => {
    if (result) {
      return result;
    }
    try {
      return require.resolve(candidate);
    } catch {
      return null;
    }
  }, null);
  if (!found) {
    throw new Error(`Can not find the test environment "${name}" (looked for ${candidates.join(', ')})`);
  }
  return found;
}

const loaded = new Map();

async function loadEnvironment(name, rootDir) {
  const file = resolveModule(name, rootDir);
  if (!loaded.has(file)) {
    const module = await import(pathToFileURL(file).href);
    // CommonJS through import: the class or object is the default export, maybe once more wrapped by a bundler.
    let exported = module.default ?? module;
    // Never a class's: its `default` may be a static one its base class has.
    if (typeof exported === 'object' && exported !== null && Object.hasOwn(exported, 'default')) {
      exported = exported.default;
    }
    loaded.set(file, exported);
  }
  return loaded.get(file);
}

// The Jest base class a class extends, and the environment vyntra installs for it.
function jestBaseOf(EnvironmentClass) {
  for (let parent = Object.getPrototypeOf(EnvironmentClass); parent && parent !== Function.prototype;) {
    if (Object.hasOwn(BASES, parent.name)) {
      // jest-environment-jsdom names its class TestEnvironment too: its global has a document.
      return { Base: parent, name: BASES[parent.name] };
    }
    parent = Object.getPrototypeOf(parent);
  }
  return { Base: null, name: 'node' };
}

// The environment vyntra installs under a custom one: node, unless a Jest class builds on jsdom.
async function baseEnvironment(name, rootDir) {
  const exported = await loadEnvironment(name, rootDir);
  if (typeof exported === 'function') {
    return jestBaseOf(exported).name ?? 'jsdom';
  }
  return 'node';
}

function copyGlobals(source, keys) {
  const originals = new Map();
  keys.forEach((key) => {
    originals.set(key, Reflect.getOwnPropertyDescriptor(globalThis, key));
    const descriptor = Reflect.getOwnPropertyDescriptor(source, key);
    Reflect.defineProperty(globalThis, key, { ...descriptor, configurable: true });
  });
  return () =>
    originals.forEach((original, key) => {
      if (original) {
        Reflect.defineProperty(globalThis, key, original);
      } else {
        Reflect.deleteProperty(globalThis, key);
      }
    });
}

// Sets up the custom environment for one test file; returns its teardown.
async function setupEnvironment(name, { rootDir, environmentOptions = {} }, testPath) {
  const exported = await loadEnvironment(name, rootDir);
  if (typeof exported?.setup === 'function' && typeof exported !== 'function') {
    const options = environmentOptions[exported.name] ?? environmentOptions;
    const result = await exported.setup(globalThis, options);
    return async () => {
      await result?.teardown?.(globalThis);
    };
  }
  if (typeof exported !== 'function') {
    throw new Error(`The test environment "${name}" is neither a Jest environment class nor a vitest environment`);
  }
  const config = {
    globalConfig: { rootDir },
    projectConfig: { rootDir, testEnvironmentOptions: environmentOptions, testEnvironment: name },
  };
  const context = { console, docblockPragmas: {}, testPath };
  const environment = new exported(config, context); // eslint-disable-line new-cap -- the project's class
  await environment.setup?.();
  const { Base } = jestBaseOf(exported);
  let names = Reflect.ownKeys(environment.global);
  if (Base) {
    const plain = new Base(config, context);
    await plain.setup?.();
    names = names.filter((key) => !Reflect.has(plain.global, key));
    await plain.teardown?.();
  } else {
    names = names.filter((key) => !Reflect.has(globalThis, key));
  }
  const restore = copyGlobals(environment.global, names);
  return async () => {
    restore();
    await environment.teardown?.();
  };
}

module.exports = { isCustom, setupEnvironment, baseEnvironment };
