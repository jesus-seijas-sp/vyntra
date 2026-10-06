// vi.mock in browser mode: the bundle sends every import of a mocked module to a stand-in (see @vyntra/web's
// bundle.js), whose exports this registry gives: what the factory returns (it may be async, and may use
// importOriginal), or, without one, the original's with its functions replaced by mock functions. vi.mock calls are
// hoisted above the test file's imports, which become awaited imports after them, as in Node; prepare() runs the
// factories in between, with the originals the bundle gave loaders for.

const KEY = Symbol.for('vyntra.browserMocks');

function createRegistry(vi) {
  const factories = new Map();
  const loaders = new Map();
  const values = new Map();

  const automock = (original) =>
    Object.fromEntries(
      Object.entries(original).map(([name, value]) => [name, typeof value === 'function' ? vi.fn() : value])
    );

  const registry = {
    // From vi.mock: the specifier as written, and its factory (or none).
    register(specifier, factory) {
      factories.set(specifier, factory ?? null);
      values.delete(specifier);
    },

    // From the bundle: how to load the original of each module a vi.mock names.
    original(specifier, load) {
      loaders.set(specifier, load);
    },

    // In the order the mocks were declared.
    prepare() {
      return [...factories]
        .filter(([specifier]) => !values.has(specifier))
        .reduce(
          (previous, [specifier, factory]) =>
            previous.then(async () => {
              const load = loaders.get(specifier);
              const original = load ? await load() : {};
              values.set(specifier, factory ? await factory(async () => original) : automock(original));
            }),
          Promise.resolve()
        );
    },

    // The exports of the stand-in: read when used.
    exports(specifier) {
      const value = () => {
        if (!values.has(specifier)) {
          throw new Error(`vi.mock('${specifier}') had not run when the module was imported`);
        }
        return values.get(specifier) ?? {};
      };
      return new Proxy(
        {},
        {
          get: (_, name) => (name === '__esModule' ? true : value()[name]),
          has: (_, name) => name in value(),
          ownKeys: () => Reflect.ownKeys(value()),
          getOwnPropertyDescriptor: (_, name) => {
            const descriptor = Reflect.getOwnPropertyDescriptor(value(), name);
            return descriptor ? { ...descriptor, configurable: true } : undefined;
          },
        }
      );
    },
  };
  globalThis[KEY] = registry;
  // The hoisted code awaits this before the test file's imports.
  globalThis[Symbol.for('vyntra.mocks')] = { prepare: () => registry.prepare() };
  return registry;
}

module.exports = { createRegistry };
