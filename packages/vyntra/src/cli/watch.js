const fs = require('node:fs');
const path = require('node:path');
const { colors: c } = require('../colors');
const { parseCli } = require('./args');
const { globToRegExp } = require('./glob');

// Watch mode (--watch, --watchAll, `vyntra watch`): one run, then a run of the tests a change touches, for as long
// as it is left running. A changed test file runs again; a changed source file reruns the test files that loaded it
// (each worker records them); a config changes everything. Keys, in a terminal: Enter reruns, a runs all, f the
// failures, p and t filter by file and by test name, q quits.

const DEBOUNCE_MS = 150;
const IGNORED_DIRS = new Set(['node_modules', '.git', '.vyntra']);
const CONFIG_FILE = /^(?:vyntra|vitest|vite|jest)\.config\.[cm]?[jt]s$|^package\.json$|^\.env(?:\..*)?$/;

// Files by their real path: Node loads ES modules from it, so through a symlinked folder (macOS's /var) the
// dependencies a worker records and the files the watcher sees change are named differently.
function realPath(file) {
  try {
    return fs.realpathSync.native(file);
  } catch {
    return file;
  }
}

const failing = (result) => result.errors.length > 0 || result.tests.some((test) => test.status === 'failed');

// The arguments that are not file patterns, to add each run's own.
function withoutPatterns(argv, patterns) {
  const rest = [...argv];
  patterns.forEach((pattern) => {
    const index = rest.lastIndexOf(pattern);
    if (index >= 0) {
      rest.splice(index, 1);
    }
  });
  return rest;
}

const toRegExp = (pattern) => {
  try {
    return new RegExp(pattern);
  } catch {
    return new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  }
};

class Watcher {
  constructor(argv, runOnce, { input = process.stdin, out = process.stdout } = {}) {
    const cli = parseCli(argv);
    this.runOnce = runOnce;
    this.options = withoutPatterns(argv, cli.patterns);
    this.filePatterns = cli.patterns;
    this.namePattern = null;
    this.input = input;
    this.out = out;
    // Test file -> the project files it loaded, and the other way round.
    this.dependencies = new Map();
    this.dependents = new Map();
    this.tests = new Set();
    this.failed = new Set();
    this.pending = new Set();
    this.running = null;
    this.last = null;
    this.done = Promise.withResolvers();
  }

  write(text) {
    this.out.write(text);
  }

  remember(results) {
    results
      .filter((result) => !result.synthetic)
      .forEach((result) => {
        this.tests.add(result.path);
        (this.dependencies.get(result.path) ?? []).forEach((dep) => this.dependents.get(dep)?.delete(result.path));
        const deps = new Set([result.path, ...(result.dependencies ?? [])].map(realPath));
        this.dependencies.set(result.path, deps);
        deps.forEach((dep) => {
          if (!this.dependents.has(dep)) {
            this.dependents.set(dep, new Set());
          }
          this.dependents.get(dep).add(result.path);
        });
        if (failing(result)) {
          this.failed.add(result.path);
        } else {
          this.failed.delete(result.path);
        }
      });
  }

  // files: the test files to run, or null for every one the filters let through.
  async run(files, reason) {
    this.last = files;
    if (reason) {
      this.write(`\n${c.bold(c.cyan(' RERUN '))} ${c.dim(reason)}\n`);
    }
    const outcome = {};
    const args = [
      ...this.options,
      ...(this.namePattern !== null ? ['-t', this.namePattern] : []),
      ...(files ?? this.filePatterns),
    ];
    const code = await this.runOnce(args, outcome);
    if (outcome.relaunched) {
      return { relaunched: true, code };
    }
    this.config = outcome.config ?? this.config;
    this.remember(outcome.results ?? []);
    this.footer();
    return { code };
  }

  footer() {
    const filters = [
      this.filePatterns.length > 0 && `files: ${this.filePatterns.join(' ')}`,
      this.namePattern !== null && `tests: ${this.namePattern}`,
    ].filter(Boolean);
    const keys = this.input.isTTY ? ' · Enter rerun · a all · f failed · p files · t tests · q quit' : '';
    this.write(`${c.dim(`\n Watching for changes${filters.length > 0 ? ` (${filters.join(', ')})` : ''}${keys}`)}\n`);
  }

  // A test file the filters let through.
  wanted(file) {
    if (this.filePatterns.length === 0) {
      return true;
    }
    const relative = path.relative(this.config.rootDir, file).split(path.sep).join('/');
    return this.filePatterns.some((pattern) => toRegExp(pattern).test(relative) || toRegExp(pattern).test(file));
  }

  // A file that could be a test file the run has not seen yet.
  looksLikeTest(file) {
    const relative = path.relative(this.config.rootDir, file).split(path.sep).join('/');
    const include = (this.config.include ?? []).map(globToRegExp);
    const exclude = (this.config.exclude ?? []).map(globToRegExp);
    return include.some((regex) => regex.test(relative)) && !exclude.some((regex) => regex.test(relative));
  }

  // The tests the changed files touch: { all } when one of them is a config.
  affected(changed) {
    const tests = new Set();
    let all = false;
    changed.forEach((file) => {
      if (file === this.config.configFile || CONFIG_FILE.test(path.basename(file))) {
        all = true;
        return;
      }
      if (!fs.existsSync(file)) {
        this.tests.delete(file);
        this.failed.delete(file);
        return;
      }
      if (this.tests.has(file) || this.looksLikeTest(file)) {
        tests.add(file);
      }
      (this.dependents.get(realPath(file)) ?? []).forEach((test) => tests.add(test));
    });
    return { all, tests: [...tests].filter((file) => this.wanted(file)) };
  }

  async flush() {
    if (this.running || this.pending.size === 0) {
      return;
    }
    const changed = [...this.pending];
    this.pending.clear();
    const { all, tests } = this.affected(changed);
    const names = changed.map((file) => path.relative(this.config.rootDir, file)).join(', ');
    if (all) {
      await this.guarded(() => this.run(null, `${names} changed: every test`));
    } else if (tests.length > 0) {
      await this.guarded(() => this.run(tests, `${names} changed`));
    } else {
      this.write(c.dim(` ${names} changed: no test loads it\n`));
    }
    await this.flush();
  }

  // One run at a time: what changes during it waits for it.
  async guarded(fn) {
    this.running = fn();
    try {
      return await this.running;
    } finally {
      this.running = null;
    }
  }

  watchFiles() {
    const { rootDir } = this.config;
    const coverageDir = path.resolve(rootDir, this.config.coverageDirectory ?? 'coverage');
    let timer = null;
    this.watcher = fs.watch(rootDir, { recursive: true }, (event, name) => {
      if (!name) {
        return;
      }
      const file = path.join(rootDir, name.toString());
      const parts = name.toString().split(/[\\/]/);
      if (
        parts.some((part) => IGNORED_DIRS.has(part)) ||
        file.startsWith(coverageDir) ||
        /(?:~|\.swp|\.swx|\.tmp)$/.test(file) ||
        (fs.existsSync(file) && fs.statSync(file).isDirectory())
      ) {
        return;
      }
      this.pending.add(file);
      clearTimeout(timer);
      timer = setTimeout(() => {
        this.flush();
      }, DEBOUNCE_MS);
    });
  }

  // A line typed after a key (p, t): Enter keeps it, Escape leaves things as they were.
  prompt(label, done) {
    let text = '';
    this.write(`\n ${label} › `);
    this.reading = (key) => {
      if (key === '\r' || key === '\n') {
        this.reading = null;
        this.write('\n');
        done(text);
      } else if (key === '\u001b') {
        this.reading = null;
        this.write('\n');
        this.footer();
      } else if (key === '\u007f') {
        text = text.slice(0, -1);
        this.write('\b \b');
      } else if (key >= ' ') {
        text += key;
        this.write(key);
      }
    };
  }

  onKey(key) {
    if (this.reading) {
      this.reading(key);
      return;
    }
    if (key === 'q' || key === '\u0003') {
      this.quit(key === 'q' ? 0 : 130);
      return;
    }
    if (this.running) {
      return;
    }
    if (key === 'a') {
      this.guarded(() => this.run(null, 'every test'));
    } else if (key === 'f') {
      const failed = [...this.failed].filter((file) => this.wanted(file));
      if (failed.length > 0) {
        this.guarded(() => this.run(failed, 'the failed files'));
      } else {
        this.write(c.dim(' No failed files\n'));
      }
    } else if (key === '\r' || key === '\n') {
      this.guarded(() => this.run(this.last, 'again'));
    } else if (key === 'p') {
      this.prompt('Files matching (empty: all)', (text) => {
        this.filePatterns = text.trim() ? text.trim().split(/\s+/) : [];
        this.guarded(() => this.run(null, 'with the new filter'));
      });
    } else if (key === 't') {
      this.prompt('Tests named (empty: all)', (text) => {
        this.namePattern = text.trim() || null;
        this.guarded(() => this.run(null, 'with the new filter'));
      });
    }
  }

  listen() {
    if (!this.input.isTTY) {
      return;
    }
    this.input.setRawMode(true);
    this.input.setEncoding('utf8');
    this.input.resume();
    this.keys = (chunk) => [...chunk].forEach((key) => this.onKey(key));
    this.input.on('data', this.keys);
  }

  quit(code) {
    this.watcher?.close();
    if (this.input.isTTY) {
      this.input.setRawMode(false);
      this.input.off('data', this.keys);
      this.input.pause();
    }
    this.done.resolve(code);
  }

  async start() {
    const first = await this.run(null, null);
    if (first.relaunched) {
      return first.code;
    }
    if (!this.config) {
      return first.code;
    }
    this.watchFiles();
    this.listen();
    process.once('SIGTERM', () => this.quit(0));
    return this.done.promise;
  }
}

// Resolves with the exit code when watching ends (q, or Ctrl+C in a terminal).
const watch = (argv, runOnce, io) => new Watcher(argv, runOnce, io).start();

module.exports = { watch, Watcher };
