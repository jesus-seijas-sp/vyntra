const fs = require('node:fs');
const path = require('node:path');

// Vite's import.meta.env, which code written for Vite reads (import.meta.env.MODE, import.meta.env.VITE_API_URL)
// and Node does not have. Project modules have it rewritten to an object over process.env, as in vitest: a value
// set with vi.stubEnv or process.env shows in both. Under it, Vite's own values (MODE 'test', DEV, PROD, SSR,
// BASE_URL) and the VITE_ variables of the project's .env files; neither is written into process.env.

const KEY = Symbol.for('vyntra.importMetaEnv');
const REPLACEMENT = "globalThis[Symbol.for('vyntra.importMetaEnv')]";
const BOOLEANS = new Set(['DEV', 'PROD', 'SSR']);

// The source with import.meta.env read from vyntra's object. On the line it was, so lines stay where they were.
function rewriteImportMetaEnv(source) {
  return source.includes('import.meta.env') ? source.replace(/\bimport\.meta\.env\b/g, REPLACEMENT) : source;
}

const asBoolean = (value) => value !== '' && value !== 'false' && value !== '0';

// fileEnv: the VITE_ variables of the .env files, read once in the main process.
function installImportMetaEnv(fileEnv = {}) {
  const defaults = () => ({
    BASE_URL: '/',
    MODE: 'test',
    DEV: true,
    PROD: false,
    // A document environment (happy-dom, jsdom) stands for the browser.
    SSR: typeof globalThis.document === 'undefined',
  });
  const read = (key) => {
    if (Object.hasOwn(process.env, key)) {
      const value = process.env[key];
      return BOOLEANS.has(key) ? asBoolean(value) : value;
    }
    return Object.hasOwn(fileEnv, key) ? fileEnv[key] : defaults()[key];
  };
  const keys = () => [...new Set([...Object.keys(defaults()), ...Object.keys(fileEnv), ...Object.keys(process.env)])];
  const env = new Proxy(
    {},
    {
      get: (_, key) => (typeof key === 'string' ? read(key) : undefined),
      set: (_, key, value) => {
        process.env[key] = String(value);
        return true;
      },
      deleteProperty: (_, key) => {
        delete process.env[key];
        return true;
      },
      has: (_, key) => typeof key === 'string' && read(key) !== undefined,
      ownKeys: () => keys(),
      getOwnPropertyDescriptor: (_, key) =>
        typeof key === 'string' && read(key) !== undefined
          ? { value: read(key), writable: true, enumerable: true, configurable: true }
          : undefined,
    }
  );
  Object.defineProperty(globalThis, KEY, { value: env, writable: true, configurable: true });
}

// "KEY=value" lines of a .env file, as dotenv reads them: `export ` allowed, quotes kept apart, # comments after
// unquoted values, \n in double quotes, ${OTHER} expanded from what came before.
function parseEnvFile(text, known) {
  const values = {};
  text.split(/\r?\n/).forEach((line) => {
    const match = /^\s*(?:export\s+)?([\w.-]+)\s*=\s*(.*)?\s*$/.exec(line);
    if (!match) {
      return;
    }
    let value = (match[2] ?? '').trim();
    const quote = value[0];
    if ((quote === '"' || quote === "'" || quote === '`') && value.lastIndexOf(quote) > 0) {
      value = value.slice(1, value.lastIndexOf(quote));
      if (quote === '"') {
        value = value.replaceAll('\\n', '\n');
      }
    } else {
      value = value.replace(/\s+#.*$/, '');
    }
    if (quote !== "'") {
      value = value.replace(/\$\{(\w+)\}/g, (_, name) => values[name] ?? known[name] ?? '');
    }
    values[match[1]] = value;
  });
  return values;
}

// The variables Vite would put in import.meta.env from the .env files of envDir: .env, .env.local, .env.test and
// .env.test.local (each over the one before), only those with the prefix (VITE_ by default).
function loadEnvFiles(envDir, prefixes = ['VITE_']) {
  const all = ['.env', '.env.local', '.env.test', '.env.test.local'].reduce((env, name) => {
    try {
      return { ...env, ...parseEnvFile(fs.readFileSync(path.join(envDir, name), 'utf8'), { ...process.env, ...env }) };
    } catch {
      return env;
    }
  }, {});
  return Object.fromEntries(
    Object.entries(all).filter(([key]) => [prefixes].flat().some((prefix) => key.startsWith(prefix)))
  );
}

module.exports = { rewriteImportMetaEnv, installImportMetaEnv, loadEnvFiles, parseEnvFile };
