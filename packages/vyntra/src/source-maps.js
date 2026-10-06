const { SourceMap } = require('node:module');

// Stack traces of compiled files (TypeScript and JSX through esbuild or TypeScript, a Jest transform) point at the
// compiled lines. The compilers leave a source map inline at the end of their output, which vyntra keeps with the
// compiled code anyway: an error that is reported has its frames translated back through it, so failures, code
// frames and failure pages show the lines of the file as written. Nothing is decoded until an error needs it.

const INLINE_MAP = /\/\/[#@] sourceMappingURL=data:application\/json(?:;charset=[\w-]+)?;base64,([A-Za-z0-9+/=]+)\s*$/;

// Where the compiled code of a file can be found: transform.js and jest-transform.js register a lookup each.
const lookups = [];

function registerCompiledCode(lookup) {
  lookups.push(lookup);
}

// Decoded maps, per file and compiled code: a file compiled again (another source) gets its own.
const decoded = new Map();

function mapOf(file) {
  const code = lookups.reduce((found, lookup) => found ?? lookup(file), null);
  if (!code) {
    return null;
  }
  const cached = decoded.get(file);
  if (cached?.code === code) {
    return cached.map;
  }
  let map = null;
  const match = INLINE_MAP.exec(code.slice(Math.max(0, code.lastIndexOf('sourceMappingURL=') - 4)));
  if (match) {
    try {
      map = new SourceMap(JSON.parse(Buffer.from(match[1], 'base64').toString('utf8')));
    } catch {
      map = null;
    }
  }
  decoded.set(file, { code, map });
  return map;
}

// The original position of a compiled one (1-based line and column), or null when the file has no map or the
// position none.
function originalPosition(file, line, column) {
  const map = mapOf(file);
  if (!map) {
    return null;
  }
  const entry = map.findEntry(line - 1, column - 1);
  if (entry.originalLine === undefined) {
    return null;
  }
  // The entry is the segment the position falls in: the rest of the way into it is the same in the original.
  const offset = entry.generatedLine === line - 1 ? column - 1 - entry.generatedColumn : 0;
  return { line: entry.originalLine + 1, column: entry.originalColumn + Math.max(0, offset) + 1 };
}

// "at fn (file:12:5)", "at file:12:5", "at async fn (file:///x.ts?vyntra=3:12:5)", "at C:\x.ts:12:5": the location
// of a V8 frame, up to its last line and column.
const FRAME = /^(\s*at (?:.*\()?)(.+):(\d+):(\d+)(\)?)\s*$/;

const toPath = (location) => {
  const bare = location.replace(/\?.*$/, '');
  return bare.startsWith('file://') ? decodeURIComponent(new URL(bare).pathname) : bare;
};

// The stack with every frame of a compiled file moved to its line in the file as written.
function mapStack(stack) {
  if (typeof stack !== 'string' || lookups.length === 0) {
    return stack;
  }
  return stack
    .split('\n')
    .map((line) => {
      const match = FRAME.exec(line);
      if (!match) {
        return line;
      }
      const [, before, location, row, column, after] = match;
      const original = originalPosition(toPath(location), Number(row), Number(column));
      return original ? `${before}${location}:${original.line}:${original.column}${after}` : line;
    })
    .join('\n');
}

module.exports = { registerCompiledCode, mapStack, originalPosition };
