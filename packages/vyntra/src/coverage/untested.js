const fs = require('node:fs');
const path = require('node:path');
const { scan, CODE } = require('../modules/scanner');
const { globToRegExp } = require('../cli/glob');

// Files the coverage is asked for (collectCoverageFrom, vitest's coverage.include) that no test loaded: reported at
// zero, as Jest and vitest do, instead of missing from the report.

const SOURCE = /\.(?:[cm]?[jt]sx?)$/;
const SKIPPED_DIRS = new Set(['node_modules', '.git', '.vyntra']);

// Where each function of a file starts, found without running it: `function` and `=>` in code, not in strings
// or comments. Enough to count a file's functions as uncovered.
function functionStarts(source) {
  const { kind } = scan(source);
  const starts = [];
  const pattern = /\bfunction\b|=>/g;
  let match = pattern.exec(source);
  while (match) {
    if (kind[match.index] === CODE) {
      starts.push(match.index);
    }
    match = pattern.exec(source);
  }
  return starts;
}

// The coverage data of a file nothing ran: no counts, its functions all at zero.
function untestedCoverage(file) {
  const source = fs.readFileSync(file, 'utf8');
  return {
    counts: new Float64Array(0),
    functions: functionStarts(source).map((offset) => ({ name: '', startOffset: offset, endOffset: offset + 1 })),
    blocks: [],
  };
}

// The source files under rootDir the coverage includes and the run did not cover: not test files (by the test
// globs, run or not), not declarations, not dependencies or the coverage report itself.
function untestedFiles(config, covered) {
  const include = config.coverageInclude;
  if (!include) {
    return [];
  }
  const testGlobs = (config.include ?? []).map(globToRegExp);
  const testFiles = new Set(config.testFiles ?? []);
  const reportDir = path.resolve(config.rootDir, config.coverageDirectory ?? 'coverage');
  const found = [];
  const walk = (dir) => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    entries.forEach((entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!SKIPPED_DIRS.has(entry.name) && full !== reportDir) {
          walk(full);
        }
        return;
      }
      const relative = path.relative(config.rootDir, full).split(path.sep).join('/');
      if (
        SOURCE.test(entry.name) &&
        !entry.name.endsWith('.d.ts') &&
        !covered.has(full) &&
        !testFiles.has(full) &&
        !testGlobs.some((regex) => regex.test(relative)) &&
        include(full)
      ) {
        found.push(full);
      }
    });
  };
  walk(config.rootDir);
  return found;
}

module.exports = { untestedFiles, untestedCoverage, functionStarts };
