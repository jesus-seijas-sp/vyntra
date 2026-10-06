// What a browser bundle of vyntra's runtime gets for Node's modules: enough for the code that loads to load, and an
// error naming what is not there for what would need Node (module mocks, snapshot files).

const missing = (name) => () => {
  throw new Error(`${name} is not available in browser mode`);
};

const sep = '/';
const normalize = (parts) =>
  parts.reduce((out, part) => {
    if (part === '..') {
      out.pop();
    } else if (part && part !== '.') {
      out.push(part);
    }
    return out;
  }, []);
const join = (...parts) => `${parts[0]?.startsWith('/') ? '/' : ''}${normalize(parts.join('/').split('/')).join('/')}`;
const pathModule = {
  sep,
  delimiter: ':',
  join,
  resolve: (...parts) => join('/', ...parts),
  dirname: (file) => file.replace(/\/[^/]*$/, '') || '/',
  basename: (file, ext) => {
    const base = file.replace(/^.*\//, '');
    return ext && base.endsWith(ext) ? base.slice(0, -ext.length) : base;
  },
  extname: (file) => /\.[^./]*$/.exec(file.replace(/^.*\//, ''))?.[0] ?? '',
  isAbsolute: (file) => file.startsWith('/'),
  relative: (from, to) => {
    const a = normalize(from.split('/'));
    const b = normalize(to.split('/'));
    let i = 0;
    while (i < a.length && a[i] === b[i]) {
      i += 1;
    }
    return [...a.slice(i).map(() => '..'), ...b.slice(i)].join('/');
  },
};
pathModule.posix = pathModule;

const format = (...args) =>
  args
    .map((arg) =>
      typeof arg === 'string'
        ? arg
        : (() => {
            try {
              return JSON.stringify(arg);
            } catch {
              return String(arg);
            }
          })()
    )
    .join(' ');

module.exports = {
  path: pathModule,
  util: {
    format,
    inspect: (value) => format(value),
    types: { isProxy: () => false, isPromise: (value) => value instanceof Promise },
  },
  fs: {
    existsSync: () => false,
    readFileSync: missing('Reading files'),
    writeFileSync: missing('Writing files'),
    mkdirSync: missing('Writing files'),
    statSync: missing('Reading files'),
    realpathSync: Object.assign((file) => file, { native: (file) => file }),
    readdirSync: () => [],
    rmSync: () => {},
  },
  url: {
    fileURLToPath: (url) => decodeURIComponent(new URL(url).pathname),
    pathToFileURL: (file) => new URL(`file://${file}`),
  },
  crypto: {
    // FNV-1a, for names that only need to be stable.
    createHash: () => {
      let text = '';
      const hash = {
        update: (data) => {
          text += data;
          return hash;
        },
        digest: () => {
          let h = 0x811c9dc5;
          for (let i = 0; i < text.length; i += 1) {
            h = Math.imul(h ^ text.charCodeAt(i), 16777619); // eslint-disable-line no-bitwise
          }
          return (h >>> 0).toString(16).padStart(8, '0').repeat(5); // eslint-disable-line no-bitwise
        },
      };
      return hash;
    },
  },
  empty: new Proxy({}, { get: (_, key) => (key === '__esModule' ? false : missing(`node:${String(key)}`)) }),
};
