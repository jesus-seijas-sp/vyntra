const fs = require('node:fs');
const path = require('node:path');
const { globToRegExp } = require('./glob');

// The `projects` of a vitest config (test.projects, or the older vitest.workspace file) and of a Jest config, as
// vyntra projects. An entry is a project written inline, or a path or glob of config files and of folders: a folder
// with a config of its own is that config's project, and one without is a project of its own whose files are found
// from there, as vitest and Jest take them. Each project runs from its own folder.

const VITEST_FILES = ['vitest.config', 'vite.config'].flatMap((name) =>
  ['ts', 'mts', 'cts', 'js', 'mjs', 'cjs'].map((ext) => `${name}.${ext}`)
);
const JEST_FILES = ['jest.config.js', 'jest.config.cjs', 'jest.config.mjs', 'jest.config.json'];
const SKIPPED = new Set(['node_modules', '.git']);

const hasGlob = (pattern) => /[*?{[]/.test(pattern);

// The files and folders a glob matches, from rootDir: walked from the part before the first wildcard.
function expandGlob(pattern, rootDir) {
  const absolute = path.resolve(rootDir, pattern);
  if (!hasGlob(pattern)) {
    return fs.existsSync(absolute) ? [absolute] : [];
  }
  const parts = absolute.split(path.sep);
  const first = parts.findIndex(hasGlob);
  const base = parts.slice(0, first).join(path.sep) || path.sep;
  const regex = globToRegExp(parts.slice(first).join('/'));
  const deep = parts.slice(first).includes('**');
  const depth = parts.length - first;
  const found = [];
  const walk = (dir, level) => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    entries.forEach((entry) => {
      const full = path.join(dir, entry.name);
      if (SKIPPED.has(entry.name)) {
        return;
      }
      if (regex.test(path.relative(base, full).split(path.sep).join('/'))) {
        found.push(full);
      }
      if (entry.isDirectory() && (deep || level + 1 < depth)) {
        walk(full, level + 1);
      }
    });
  };
  walk(base, 0);
  return found.sort();
}

const isDirectory = (file) => {
  try {
    return fs.statSync(file).isDirectory();
  } catch {
    return false;
  }
};

function packageName(dir) {
  try {
    return JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')).name;
  } catch {
    return undefined;
  }
}

// A project from a vitest or Jest config read from its folder: its files found from there, its setup files and
// options resolved from there, and none of the root config's options unless it asks for them.
function asProject(config, { root, name, inherit }) {
  return {
    ...config,
    name,
    root,
    roots: config.roots ?? [root],
    inherit,
  };
}

function nameOf(given, root, rootDir) {
  const label = typeof given === 'object' && given !== null ? (given.label ?? given.name) : given;
  return label ?? packageName(root) ?? (path.relative(rootDir, root) || path.basename(root));
}

// One after the other, in the order the entries give them.
const inOrder = (items, fn) => items.reduce((prev, item) => prev.then(() => fn(item)), Promise.resolve());

// readers: { importConfig, fromVitestConfig, fromJestConfig, readJestPackage }, from config.js.
async function vitestProjects(entries, rootDir, readers) {
  const projects = [];
  const fromConfig = (vite, root, inherit) => {
    const test = vite.test ?? {};
    const projectRoot = path.resolve(root, test.root ?? vite.root ?? '.');
    projects.push(
      asProject(readers.fromVitestConfig(vite, projectRoot), {
        root: projectRoot,
        name: nameOf(test.name, projectRoot, rootDir),
        inherit,
      })
    );
  };
  const fromFile = async (file) => fromConfig(await readers.importConfig(file), path.dirname(file), false);
  const fromMatch = async (match) => {
    if (!isDirectory(match)) {
      return fromFile(match);
    }
    const own = VITEST_FILES.map((name) => path.join(match, name)).find((file) => fs.existsSync(file));
    return own ? fromFile(own) : fromConfig({}, match, false);
  };
  await inOrder(entries, (entry) =>
    typeof entry === 'string'
      ? inOrder(expandGlob(entry, rootDir), fromMatch)
      : fromConfig(entry, rootDir, entry.extends === true)
  );
  return projects;
}

async function jestProjects(entries, rootDir, readers) {
  const projects = [];
  const fromConfig = (jest, root) => {
    const projectRoot = path.resolve(root, (jest.rootDir ?? '.').replaceAll('<rootDir>', rootDir));
    projects.push(
      asProject(readers.fromJestConfig({ ...jest, rootDir: projectRoot }, projectRoot), {
        root: projectRoot,
        name: nameOf(jest.displayName, projectRoot, rootDir),
        inherit: false,
      })
    );
  };
  const fromMatch = async (match) => {
    if (!isDirectory(match)) {
      return fromConfig(await readers.importConfig(match), path.dirname(match));
    }
    const own = JEST_FILES.map((name) => path.join(match, name)).find((file) => fs.existsSync(file));
    return fromConfig(own ? await readers.importConfig(own) : (readers.readJestPackage(match) ?? {}), match);
  };
  await inOrder(entries, (entry) =>
    typeof entry === 'string'
      ? inOrder(expandGlob(entry.replaceAll('<rootDir>', rootDir), rootDir), fromMatch)
      : fromConfig(entry, rootDir)
  );
  return projects;
}

// The vyntra projects of { kind: 'vitest' | 'jest', entries }.
function expandProjects({ kind, entries }, rootDir, readers) {
  return kind === 'jest' ? jestProjects(entries, rootDir, readers) : vitestProjects(entries, rootDir, readers);
}

module.exports = { expandProjects, expandGlob };
