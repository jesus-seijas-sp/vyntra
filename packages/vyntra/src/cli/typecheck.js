const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { scan } = require('../modules/scanner');
const { globToRegExp } = require('./glob');

// Type tests, as vitest runs them with --typecheck: the *.test-d.ts files are not run, they are checked, with the
// project's tsc (or vue-tsc) through a tsconfig that extends the project's and includes only them. Each error goes
// to the test whose call it is in; one outside every test fails the file, and one in a file that is not a type test
// fails the run, unless ignoreSourceErrors.

const DEFAULT_INCLUDE = ['**/*.{test,spec}-d.?(c|m)[jt]s?(x)'];
const CHECKERS = { tsc: 'typescript/bin/tsc', 'vue-tsc': 'vue-tsc/bin/vue-tsc.js' };
const TEST_CALL = /\b(describe|suite|it|test)(?:\s*\.\s*(?:skip|only|todo|concurrent|sequential|fails))*\s*\(/g;

// The tests and suites of a source, without running it: { name, kind, start, end, parent } for every call of
// describe/it/test whose first argument is a string.
function testsOf(source) {
  const scanner = scan(source);
  const found = [];
  let match = TEST_CALL.exec(source);
  while (match) {
    const open = match.index + match[0].length - 1;
    const close = scanner.isCode(match.index) ? scanner.closingParen(open) : -1;
    const name = /^\s*(['"`])((?:\\.|(?!\1).)*)\1/.exec(source.slice(open + 1))?.[2];
    if (close !== -1 && name !== undefined) {
      found.push({
        name,
        kind: match[1] === 'describe' || match[1] === 'suite' ? 'suite' : 'test',
        start: open,
        end: close,
      });
    }
    match = TEST_CALL.exec(source);
  }
  return found.map((item) => ({
    ...item,
    path: [
      ...found
        .filter((outer) => outer.kind === 'suite' && outer.start < item.start && outer.end > item.end)
        .map((outer) => outer.name),
      item.name,
    ],
  }));
}

const lineStarts = (source) => [0, ...[...source.matchAll(/\n/g)].map((match) => match.index + 1)];

// tsc's errors: "file(line,col): error TS2322: message", with the message going on over indented lines.
function parseDiagnostics(output, cwd) {
  const diagnostics = [];
  output.split(/\r?\n/).forEach((line) => {
    const match = /^(.+?)\((\d+),(\d+)\): error (TS\d+): (.*)$/.exec(line);
    if (match) {
      diagnostics.push({
        file: path.resolve(cwd, match[1]),
        line: Number(match[2]),
        column: Number(match[3]),
        code: match[4],
        message: match[5],
      });
    } else if (/^\s/.test(line) && diagnostics.length > 0 && line.trim()) {
      diagnostics.at(-1).message += `\n${line.trim()}`;
    }
  });
  return diagnostics;
}

function typeError(diagnostic) {
  return {
    name: 'TypeCheckError',
    message: `${diagnostic.message} (${diagnostic.code})`,
    stack: `TypeCheckError: ${diagnostic.message}\n    at ${diagnostic.file}:${diagnostic.line}:${diagnostic.column}`,
  };
}

function walk(dir, regexes, rootDir, found = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return found;
  }
  entries.forEach((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && !entry.name.startsWith('.')) {
        walk(full, regexes, rootDir, found);
      }
    } else if (regexes.some((regex) => regex.test(path.relative(rootDir, full).split(path.sep).join('/')))) {
      found.push(full);
    }
  });
  return found;
}

// The type test files of the project, by typecheck.include.
function typeTestFiles(config, patterns = []) {
  const include = (config.typecheck?.include ?? DEFAULT_INCLUDE).map(globToRegExp);
  const files = walk(config.rootDir, include, config.rootDir).sort();
  if (patterns.length === 0) {
    return files;
  }
  return files.filter((file) => patterns.some((pattern) => file.includes(pattern) || new RegExp(pattern).test(file)));
}

// Runs the checker on the type test files; returns their results, as the runner's (one per file), and the errors
// of other files.
function runTypecheck(config, files) {
  const { rootDir } = config;
  const options = config.typecheck ?? {};
  const checker = CHECKERS[options.checker ?? 'tsc'] ?? options.checker;
  let bin;
  try {
    bin = Module.createRequire(path.join(rootDir, 'package.json')).resolve(checker);
  } catch {
    throw new Error(
      `Type checking needs ${options.checker ?? 'tsc'} in the project: npm install --save-dev typescript`
    );
  }
  const base = path.resolve(rootDir, options.tsconfig ?? 'tsconfig.json');
  // Next to the project's, so its relative paths mean the same; removed after.
  const tsconfig = path.join(path.dirname(base), `tsconfig.vyntra-typecheck-${process.pid}.json`);
  fs.writeFileSync(
    tsconfig,
    JSON.stringify({
      ...(fs.existsSync(base) ? { extends: `./${path.basename(base)}` } : {}),
      compilerOptions: { noEmit: true, incremental: false, composite: false },
      // Added to what the project's tsconfig includes, which keeps its global declarations.
      files,
    })
  );
  const start = performance.now();
  let output;
  try {
    const result = spawnSync(process.execPath, [bin, '--noEmit', '--pretty', 'false', '-p', tsconfig], {
      cwd: path.dirname(tsconfig),
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    });
    output = `${result.stdout}${result.stderr}`;
  } finally {
    fs.rmSync(tsconfig, { force: true });
  }
  const duration = performance.now() - start;
  const diagnostics = parseDiagnostics(output, path.dirname(tsconfig));
  const ours = new Set(files);
  const results = files.map((file) => {
    const source = fs.readFileSync(file, 'utf8');
    const starts = lineStarts(source);
    const tests = testsOf(source).filter((item) => item.kind === 'test');
    const records = tests.map((item, index) => ({
      name: item.path.join(' '),
      path: item.path,
      index,
      status: 'passed',
      duration: 0,
      errors: [],
    }));
    const errors = [];
    diagnostics
      .filter((diagnostic) => diagnostic.file === file)
      .forEach((diagnostic) => {
        const offset = (starts[diagnostic.line - 1] ?? 0) + diagnostic.column - 1;
        const owner = tests.reduce(
          (best, item, i) =>
            item.start <= offset && item.end >= offset && (best === -1 || item.start > tests[best].start) ? i : best,
          -1
        );
        if (owner === -1) {
          errors.push(typeError(diagnostic));
        } else {
          Object.assign(records[owner], { status: 'failed' });
          records[owner].errors.push(typeError(diagnostic));
        }
      });
    return {
      path: file,
      duration: duration / files.length,
      collectDuration: 0,
      tests: records,
      errors,
      console: [],
      snapshot: null,
      typecheck: true,
    };
  });
  const outside = diagnostics.filter((diagnostic) => !ours.has(diagnostic.file));
  return { results, outside };
}

module.exports = { runTypecheck, typeTestFiles, testsOf, parseDiagnostics, typeError, DEFAULT_INCLUDE };
