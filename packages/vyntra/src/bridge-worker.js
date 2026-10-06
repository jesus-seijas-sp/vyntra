const path = require('node:path');
const { workerData, parentPort } = require('node:worker_threads');

// The helper thread of sync-bridge.js: runs what can be async (a Jest processAsync, Vite plugins' hooks) and sets
// the shared flag when its answer is on the port.

const { shared, port } = workerData;

const ORDER = { pre: 0, undefined: 1, post: 2 };
let plugins = [];
const transformers = new Map();

// A hook as a function, or Vite's object form { handler, order }.
const hookOf = (plugin, name) => {
  const hook = plugin?.[name];
  return typeof hook === 'function' ? hook : hook?.handler;
};

const context = {
  warn: (message) => process.emitWarning(String(message?.message ?? message)),
  error: (message) => {
    throw message instanceof Error ? message : new Error(String(message));
  },
  // A plugin may resolve through the others, as Vite's this.resolve (handlers is defined below; called later).
  // eslint-disable-next-line no-use-before-define
  resolve: (source, importer) => handlers.resolveId(source, importer).then((id) => (id ? { id } : null)),
};

// What a hook gave as code: a string, or { code }.
const codeOf = (result, fallback) => {
  if (result == null) {
    return fallback;
  }
  return typeof result === 'string' ? result : (result.code ?? fallback);
};

const inOrder = (items, fn) => items.reduce((prev, item) => prev.then(() => fn(item)), Promise.resolve());

// The answer of the first plugin whose hook gives one (resolveId, load).
const firstAnswer = (name, args) =>
  plugins.reduce(
    (previous, plugin) =>
      previous.then((found) =>
        found != null && found !== false ? found : hookOf(plugin, name)?.call(context, ...args)
      ),
    Promise.resolve(null)
  );

const handlers = {
  async initPlugins({ configFile, projectIndex, rootDir }) {
    // eslint-disable-next-line global-require -- only when there are plugins to run here
    const { importConfig } = require('./cli/config');
    const loaded = await importConfig(configFile);
    const list = loaded?.projects?.[projectIndex]?.plugins ?? loaded?.plugins ?? loaded?.test?.plugins;
    plugins = [list ?? []]
      .flat(Infinity)
      .filter((plugin) => plugin && typeof plugin === 'object')
      .sort((a, b) => ORDER[a.enforce] - ORDER[b.enforce]);
    const resolved = { root: rootDir, command: 'serve', mode: 'test', isProduction: false, plugins };
    // In order, as Vite runs them.
    await inOrder(plugins, (plugin) => hookOf(plugin, 'configResolved')?.call(context, resolved));
    await inOrder(plugins, (plugin) => hookOf(plugin, 'buildStart')?.call(context, {}));
    return plugins.length;
  },

  async transform(code, id) {
    // Each transform takes the one before's output.
    return plugins.reduce(
      (previous, plugin) =>
        previous.then(async (source) => {
          const result = await hookOf(plugin, 'transform')?.call(context, source, id);
          return codeOf(result, source);
        }),
      Promise.resolve(code)
    );
  },

  // The first plugin to resolve it: an id (a path, or a virtual one), or null.
  async resolveId(source, importer) {
    const result = await firstAnswer('resolveId', [source, importer, { isEntry: false }]);
    if (result == null || result === false || result.external) {
      return null;
    }
    return typeof result === 'string' ? result : result.id;
  },

  async load(id) {
    const result = await firstAnswer('load', [id]);
    return codeOf(result, null);
  },

  // A Jest transformer that only has processAsync.
  async jestTransform(file, options, source, filename, transformOptions) {
    const key = `${file}\0${JSON.stringify(options)}`;
    if (!transformers.has(key)) {
      // eslint-disable-next-line global-require -- the project's transformer
      const loaded = require(path.resolve(file));
      // eslint-disable-next-line no-underscore-dangle -- the marker's name
      const module = loaded?.__esModule && loaded.default ? loaded.default : loaded;
      transformers.set(
        key,
        typeof module.createTransformer === 'function' ? await module.createTransformer(options) : module
      );
    }
    const result = await transformers.get(key).processAsync(source, filename, transformOptions);
    return typeof result === 'string' ? { code: result } : { code: result.code, map: result.map ?? null };
  },
};

parentPort.on('message', async ({ method, args }) => {
  let reply;
  try {
    reply = { result: await handlers[method](...args) };
  } catch (error) {
    reply = { error: { message: String(error?.message ?? error), stack: error?.stack ?? '' } };
  }
  port.postMessage(reply);
  Atomics.store(shared, 0, 1);
  Atomics.notify(shared, 0);
});
