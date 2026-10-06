const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const { hoistMocks } = require('./hoist');

// A test file for the browser: bundled with the project's esbuild (a Vite project has it) together with vyntra's
// runtime for pages (vyntra/src/browser/runtime.js), which collects its tests and runs them, and its setup files.
// Packages come along as Vite's pre-bundling would bring them; Node's own modules become stand-ins that say what is
// missing; `vitest` and `vyntra` imports are the runtime's API; stylesheets are added to the page.

const BUILTINS =
  /^(?:node:)?(fs|fs\/promises|path|util|url|crypto|module|worker_threads|os|inspector|child_process|vm|events|timers|timers\/promises|async_hooks|perf_hooks|stream|buffer|assert|tty|process|http|https|net|zlib|readline)$/;
const API = /^(?:vitest|vyntra|@jest\/globals|vitest\/globals)$/;
const BROWSER_API = /^(?:vitest\/browser|@vitest\/browser\/context|vyntra\/browser)$/;

// Node's globals some modules read as they load, as Vite's browser builds leave them.
const PROCESS = `globalThis.__dirname ??= '/'; globalThis.__filename ??= '/index.js'; globalThis.global ??= globalThis;
globalThis.process ??= { env: { NODE_ENV: 'test' }, platform: 'browser', version: 'v22.0.0', versions: {}, argv: [],
  execArgv: [], pid: 1, cwd: () => '/', on() { return this; }, once() { return this; }, off() { return this; },
  removeListener() { return this; }, listeners: () => [], emitWarning() {}, exit() {},
  nextTick: (fn, ...args) => queueMicrotask(() => fn(...args)), hrtime: Object.assign(() => [0, 0], { bigint: () => 0n }),
  memoryUsage: () => ({}), stdout: { write() {}, isTTY: false }, stderr: { write() {}, isTTY: false } };`;

function esbuildOf(rootDir) {
  try {
    return Module.createRequire(path.join(rootDir, 'package.json'))('esbuild');
  } catch {
    try {
      // eslint-disable-next-line global-require -- the one installed with @vyntra/web, if any
      return require('esbuild');
    } catch {
      throw new Error(
        'Browser mode bundles test files with esbuild: install it (npm install --save-dev esbuild), as Vite does'
      );
    }
  }
}

// vyntra's own files: the runtime for pages and what stands in for Node.
function coreFiles(rootDir) {
  let manifest;
  try {
    manifest = Module.createRequire(path.join(rootDir, 'package.json')).resolve('vyntra/package.json');
  } catch {
    manifest = require.resolve('vyntra/package.json');
  }
  const src = path.join(path.dirname(manifest), 'src');
  return {
    runtime: path.join(src, 'browser', 'runtime.js'),
    context: path.join(src, 'browser', 'context.js'),
    stubs: path.join(src, 'browser', 'node-stubs.js'),
    host: path.join(src, 'browser', 'host.js'),
  };
}

const CSS_MODULE = /\.module\.(?:css|scss|sass|less)$/;

const MOCK_CALL = /\b(?:vi|jest)\s*\.\s*(?:mock|doMock)\s*\(\s*(['"`])([^'"`]+)\1/g;
const HOISTED = /\b(?:vi|jest)\s*\.\s*(?:mock|unmock|hoisted)\s*\(/;
const SCRIPT = /\.[cm]?[jt]sx?$/;
const LOADERS = { '.ts': 'ts', '.mts': 'ts', '.cts': 'ts', '.tsx': 'tsx', '.jsx': 'jsx' };

// The modules vi.mock names in these files, as written, and the folder each is resolved from.
async function mockDeclarations(files) {
  const declared = new Map();
  await Promise.all(
    files.map(async (file) => {
      const source = await fs.promises.readFile(file, 'utf8').catch(() => '');
      [...source.matchAll(MOCK_CALL)].forEach(([, , specifier]) => {
        if (!declared.has(specifier)) {
          declared.set(specifier, path.dirname(file));
        }
      });
    })
  );
  return declared;
}

function plugin(core, { declared, hoist }) {
  return {
    name: 'vyntra-browser',
    setup(build) {
      // A module a vi.mock names: every import of it, but its original's, goes to the stand-in. The names are resolved
      // once, inside the build (where esbuild resolves), from the file each was written in.
      const own = { vyntraOriginal: true };
      const resolveFrom = (specifier, resolveDir) =>
        build.resolve(specifier, { resolveDir, kind: 'import-statement', pluginData: own });
      let mockedPaths = null;
      const mocked = () => {
        mockedPaths ??= Promise.all(
          [...declared].map(async ([specifier, dir]) => [(await resolveFrom(specifier, dir)).path, specifier])
        ).then((entries) => new Map(entries.filter(([file]) => file)));
        return mockedPaths;
      };
      if (declared.size > 0) {
        build.onResolve({ filter: /^vyntra-original:/ }, async (args) => {
          const specifier = decodeURIComponent(args.path.slice('vyntra-original:'.length));
          return { path: (await resolveFrom(specifier, declared.get(specifier))).path };
        });
        build.onResolve({ filter: /.*/ }, async (args) => {
          if (args.pluginData?.vyntraOriginal || args.namespace !== 'file' || args.path.startsWith('vyntra-')) {
            return undefined;
          }
          const resolved = await build.resolve(args.path, {
            resolveDir: args.resolveDir,
            kind: args.kind,
            importer: args.importer,
            pluginData: own,
          });
          const specifier = resolved.path && (await mocked()).get(resolved.path);
          return specifier ? { path: specifier, namespace: 'vyntra-mock' } : undefined;
        });
        build.onLoad({ filter: /.*/, namespace: 'vyntra-mock' }, (args) => ({
          contents: `module.exports = globalThis[Symbol.for('vyntra.browserMocks')].exports(${JSON.stringify(args.path)});`,
          loader: 'js',
        }));
      }
      // vi.mock calls above the imports, which become awaited imports after them, as in Node.
      build.onLoad({ filter: SCRIPT }, async (args) => {
        if (!hoist.has(args.path)) {
          return undefined;
        }
        const source = await fs.promises.readFile(args.path, 'utf8');
        return { contents: hoistMocks(source, { esm: true }), loader: LOADERS[path.extname(args.path)] ?? 'js' };
      });
      build.onResolve({ filter: BUILTINS }, (args) => ({
        path: BUILTINS.exec(args.path)[1],
        namespace: 'vyntra-node',
      }));
      build.onLoad({ filter: /.*/, namespace: 'vyntra-node' }, (args) => ({
        contents: `const stubs = require(${JSON.stringify(core.stubs)});\nmodule.exports = stubs[${JSON.stringify(args.path)}] ?? stubs.empty;`,
        resolveDir: path.dirname(core.stubs),
      }));
      build.onResolve({ filter: API }, () => ({ path: core.runtime, namespace: 'vyntra-api' }));
      build.onLoad({ filter: /.*/, namespace: 'vyntra-api' }, () => ({
        contents: `module.exports = require(${JSON.stringify(core.runtime)}).api;`,
        resolveDir: path.dirname(core.runtime),
      }));
      build.onResolve({ filter: BROWSER_API }, () => ({ path: core.context }));
      // A stylesheet joins the page; a CSS module's import is its class names, as they are written.
      build.onLoad({ filter: /\.css$/ }, async (args) => {
        const css = await fs.promises.readFile(args.path, 'utf8');
        const names = CSS_MODULE.test(args.path)
          ? [...new Set([...css.matchAll(/\.([A-Za-z_][\w-]*)/g)].map((m) => m[1]))]
          : [];
        return {
          contents: `const style = document.createElement('style');
style.textContent = ${JSON.stringify(css)};
document.head.append(style);
export default ${JSON.stringify(Object.fromEntries(names.map((name) => [name, name])))};`,
          loader: 'js',
        };
      });
    },
  };
}

// The bundle of one test file: { code, map } (map: the source map's JSON, kept to read stack traces with).
async function bundleTestFile(file, config) {
  const { rootDir } = config;
  const esbuild = esbuildOf(rootDir);
  const core = coreFiles(rootDir);
  // eslint-disable-next-line global-require -- vyntra's internals, by path
  const host = require(core.host);
  const pageConfig = {
    ...host.pageConfig(file, config),
    rootDir,
    testTimeout: config.testTimeout,
    hookTimeout: config.hookTimeout,
    testNamePattern: config.testNamePattern,
    retry: config.retry,
    clearMocks: config.clearMocks,
    resetMocks: config.resetMocks,
    restoreMocks: config.restoreMocks,
    hookOrder: config.hookOrder,
    use: config.use,
  };
  // The modules the test file and its setup files mock, and loaders of their originals for the registry.
  const scanned = [...(config.setupFiles ?? []), file];
  const declared = await mockDeclarations(scanned);
  const hoist = new Set(
    (
      await Promise.all(
        scanned.map(async (one) => (HOISTED.test(await fs.promises.readFile(one, 'utf8').catch(() => '')) ? one : null))
      )
    ).filter(Boolean)
  );
  const originals = [...declared.keys()]
    .map(
      (specifier) =>
        `registry.original(${JSON.stringify(specifier)}, () => import(${JSON.stringify(`vyntra-original:${encodeURIComponent(specifier)}`)}));`
    )
    .join('\n');
  // In order: the runtime (and its globals), the setup files, then the test file, loaded where errors are caught.
  const imports = [...(config.setupFiles ?? []), file]
    .map((one) => `  await import(${JSON.stringify(one)});`)
    .join('\n');
  const entry = `import { prepare, finish } from ${JSON.stringify(core.runtime)};
const config = ${JSON.stringify(pageConfig)};
prepare({ path: ${JSON.stringify(file)}, config });
const registry = globalThis[Symbol.for('vyntra.browserMocks')];
${originals}
let error;
try {
${imports}
} catch (caught) {
  error = caught;
}
await globalThis.__vyntraReport(await finish({ config, error }));
`;
  const env = Object.fromEntries(
    Object.entries({ ...config.importMetaEnv, MODE: 'test', DEV: true, PROD: false, SSR: false, BASE_URL: '/' }).map(
      ([key, value]) => [`import.meta.env.${key}`, JSON.stringify(value)]
    )
  );
  const result = await esbuild.build({
    stdin: { contents: entry, resolveDir: rootDir, sourcefile: '__vyntra_entry.js', loader: 'js' },
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: 'es2022',
    write: false,
    outfile: path.join(rootDir, '__vyntra_bundle.js'),
    sourcemap: 'external',
    logLevel: 'silent',
    jsx: 'automatic',
    loader: {
      '.png': 'dataurl',
      '.jpg': 'dataurl',
      '.jpeg': 'dataurl',
      '.gif': 'dataurl',
      '.svg': 'dataurl',
      '.webp': 'dataurl',
      '.woff': 'dataurl',
      '.woff2': 'dataurl',
    },
    define: { 'process.env.NODE_ENV': '"test"', 'import.meta.vitest': 'undefined', ...env },
    banner: { js: PROCESS },
    alias: Object.fromEntries(
      (config.alias ?? [])
        .filter(({ find }) => typeof find === 'string')
        .map(({ find, replacement }) => [find, replacement])
    ),
    plugins: [plugin(core, { declared, hoist })],
  });
  const code = result.outputFiles.find((output) => output.path.endsWith('.js')).text;
  const map = result.outputFiles.find((output) => output.path.endsWith('.map'))?.text ?? null;
  return { code, map };
}

module.exports = { coreFiles, bundleTestFile };
