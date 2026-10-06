const Module = require('node:module');
const path = require('node:path');

// An engine adds a kind of test to a project (engine: 'web'): its fixtures, its matchers, and the defaults that suit
// it. It is a package of its own (@vyntra/web), installed by the projects that use it, so the core stays small.
const packageOf = (name) => (name.startsWith('@') || name.includes('/') ? name : `@vyntra/${name}`);

const loaded = new Map();

// { fixtures, matchers, defaults } of the engine, from the project's dependencies (or vyntra's own, in its
// repository).
function loadEngine(name, rootDir) {
  const id = packageOf(name);
  if (!loaded.has(id)) {
    let engine;
    try {
      engine = Module.createRequire(path.join(rootDir, 'package.json'))(id);
    } catch (error) {
      if (error.code !== 'MODULE_NOT_FOUND' || !String(error.message).includes(id)) {
        throw error;
      }
      try {
        // eslint-disable-next-line global-require -- an optional package
        engine = require(id);
      } catch {
        throw new Error(`The "${name}" engine is the ${id} package: install it (npm install --save-dev ${id})`);
      }
    }
    loaded.set(id, engine);
  }
  return loaded.get(id);
}

// A config with the engine's defaults under it: those the user did not set (`explicit`, the keys they gave).
function withEngineDefaults(config, explicit) {
  if (!config.engine) {
    return config;
  }
  const { defaults = {} } = loadEngine(config.engine, config.rootDir);
  const filled = Object.fromEntries(Object.entries(defaults).filter(([key]) => !explicit.has(key)));
  return { ...config, ...filled, use: { ...defaults.use, ...config.use } };
}

module.exports = { loadEngine, withEngineDefaults };
