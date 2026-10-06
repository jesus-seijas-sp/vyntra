// The Vite plugins of the config, run on every file vyntra compiles, so a rewrite a project relies on under vitest
// (an import split into deep paths, a barrel flattened, a virtual module) happens here too. Plugins are functions,
// which do not cross to a worker: each thread loads them from the config file itself.
//
// Plugins with only synchronous transforms run in the thread, as fast as a function call. vyntra's module hooks are
// synchronous, so plugins that need more (resolveId, load, an async transform) run on the bridge's helper thread
// (sync-bridge.js), all of them, in their order, and the hooks wait for their answers.

const { callSync } = require('./sync-bridge');

const ORDER = { pre: 0, undefined: 1, post: 2 };

let plugins = [];
let bridged = false;
let pluginOptions = null;

// Plugins' resolveId and load answers, remembered: every test file imports the project afresh.
const resolved = new Map();
const loads = new Map();

const context = {
  warn: (message) => process.emitWarning(String(message?.message ?? message)),
  error: (message) => {
    throw message instanceof Error ? message : new Error(String(message));
  },
};

// A hook as a function, or Vite's object form { handler, order }.
const hookOf = (plugin, name) => {
  const hook = plugin?.[name];
  return typeof hook === 'function' ? hook : hook?.handler;
};

const isAsync = (fn) => fn?.constructor?.name === 'AsyncFunction';

// Whether the plugins need the helper thread: hooks vyntra can only wait for there.
const needsBridge = (list) =>
  list.some(
    (plugin) =>
      hookOf(plugin, 'resolveId') ||
      hookOf(plugin, 'load') ||
      isAsync(hookOf(plugin, 'transform')) ||
      isAsync(hookOf(plugin, 'buildStart')) ||
      isAsync(hookOf(plugin, 'configResolved'))
  );

const hasHooks = (plugin) => ['transform', 'resolveId', 'load'].some((name) => hookOf(plugin, name));

function startBridge() {
  bridged = true;
  resolved.clear();
  loads.clear();
  callSync('initPlugins', pluginOptions);
}

async function loadPlugins(config) {
  let list = config.plugins;
  const missing = !list?.some?.(hasHooks);
  if (missing && config.configFile && config.transformPlugins !== false) {
    // eslint-disable-next-line global-require -- the config is only reloaded where it lost its functions
    const { importConfig } = require('./cli/config');
    const loaded = await importConfig(config.configFile);
    // A project's own plugins, or the top level's it inherits.
    list = loaded?.projects?.[config.projectIndex]?.plugins ?? loaded?.plugins ?? loaded?.test?.plugins;
  }
  plugins = [list ?? []]
    .flat(Infinity)
    .filter(hasHooks)
    .sort((a, b) => ORDER[a.enforce] - ORDER[b.enforce]);
  pluginOptions = { configFile: config.configFile, projectIndex: config.projectIndex, rootDir: config.rootDir };
  bridged = false;
  if (plugins.length > 0 && config.configFile && needsBridge(plugins)) {
    startBridge();
    return;
  }
  const settings = { root: config.rootDir, command: 'serve', mode: 'test', isProduction: false, plugins };
  await Promise.all(plugins.map((plugin) => hookOf(plugin, 'configResolved')?.call(context, settings)));
  // Vite starts a build before it transforms anything: a plugin may set up what its transform reads.
  await Promise.all(plugins.map((plugin) => hookOf(plugin, 'buildStart')?.call(context, {})));
}

function applyPlugins(code, file) {
  if (bridged) {
    return callSync('transform', code, file);
  }
  let source = code;
  for (let i = 0; i < plugins.length; i += 1) {
    const result = hookOf(plugins[i], 'transform')?.call(context, source, file);
    if (typeof result?.then === 'function') {
      // A transform that turns out to be async: from now on the plugins run on the helper thread.
      result.catch(() => {});
      if (!pluginOptions?.configFile) {
        throw new Error(
          `The transform hook of the "${plugins[i].name}" plugin is async, and needs a config file to run`
        );
      }
      startBridge();
      return callSync('transform', code, file);
    }
    if (result != null) {
      source = typeof result === 'string' ? result : (result.code ?? source);
    }
  }
  return source;
}

// The id a plugin resolves a specifier to (a path, or a virtual id), or null; null at once without such plugins.
function resolveWithPlugins(specifier, importer) {
  if (!bridged) {
    return null;
  }
  const key = `${specifier}\0${importer ?? ''}`;
  if (!resolved.has(key)) {
    resolved.set(key, callSync('resolveId', specifier, importer));
  }
  return resolved.get(key);
}

// The code a plugin loads for an id, or null.
function loadWithPlugins(id) {
  if (!bridged) {
    return null;
  }
  if (!loads.has(id)) {
    loads.set(id, callSync('load', id));
  }
  return loads.get(id);
}

// Plugins' transforms of a file vyntra does not compile (plain JavaScript, TypeScript Node strips), as vitest runs
// them on every file: kept per file and source, as every test file loads the project again.
const transformed = new Map();

function transformWithPlugins(code, file) {
  if (plugins.length === 0) {
    return code;
  }
  const kept = transformed.get(file);
  if (kept?.source === code) {
    return kept.code;
  }
  const result = applyPlugins(code, file);
  transformed.set(file, { source: code, code: result });
  return result;
}

const pluginNames = () => plugins.map((plugin) => plugin.name ?? '?');

module.exports = {
  loadPlugins,
  applyPlugins,
  transformWithPlugins,
  resolveWithPlugins,
  loadWithPlugins,
  pluginNames,
  hasHooks,
};
