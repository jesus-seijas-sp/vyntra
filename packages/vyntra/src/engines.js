const Module = require('node:module');
const path = require('node:path');

// An engine adds a kind of test to a project (engine: 'web'): its fixtures, its matchers, and the defaults that suit
// it. It is a package of its own (@vyntra/web), installed by the projects that use it, so the core stays small.
const packageOf = (name) =>
  name.startsWith('@') || name.includes('/') || path.isAbsolute(name) ? name : `@vyntra/${name}`;

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

// The engines of a project: engine: 'web', or several (engine: ['web', 'ai']), each loaded once.
const enginesOf = (config) =>
  [config.engine ?? []].flat().map((name) => ({ name, engine: loadEngine(name, config.rootDir) }));

// A config with the engines' defaults under it: those the user did not set (`explicit`, the keys they gave). With
// several engines, a later one's default wins over an earlier one's (engine: ['web', 'ai']: the AI engine's longer
// timeouts).
function withEngineDefaults(config, explicit) {
  const engines = enginesOf(config);
  if (engines.length === 0) {
    return config;
  }
  return engines.reduce((filledConfig, { engine: { defaults = {} } }) => {
    const filled = Object.fromEntries(Object.entries(defaults).filter(([key]) => !explicit.has(key)));
    return { ...filledConfig, ...filled, use: { ...filledConfig.use, ...defaults.use, ...config.use } };
  }, config);
}

module.exports = { loadEngine, enginesOf, withEngineDefaults };
