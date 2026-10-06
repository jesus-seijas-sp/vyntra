/* eslint-disable no-bitwise -- base64 VLQ, the encoding of source maps */
const fs = require('node:fs');
const { compiledCodeOf, inlineMapOf } = require('../source-maps');

// V8 counts the code it ran. For a file a compiler reformatted (esbuild, TypeScript), those positions are not the
// file's: before the coverage leaves the worker, its counts, functions and blocks are moved through the compiler's
// source map onto the file as written. What the map leaves out (types, comments) is not code there.

const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const DIGITS = new Map([...BASE64].map((char, i) => [char, i]));

function lineStarts(source) {
  const starts = [0];
  for (let i = source.indexOf('\n'); i !== -1; i = source.indexOf('\n', i + 1)) {
    starts.push(i + 1);
  }
  return starts;
}

// The values of one segment of "mappings".
function decodeSegment(segment) {
  const values = [];
  let value = 0;
  let shift = 0;
  [...segment].forEach((char) => {
    const digit = DIGITS.get(char);
    value += (digit & 31) << shift;
    if (digit & 32) {
      shift += 5;
    } else {
      values.push(value & 1 ? -(value >>> 1) : value >>> 1);
      value = 0;
      shift = 0;
    }
  });
  return values;
}

// Per generated line, its segments in order: { column, line, originalColumn } (0-based). Segments without a
// source (only a column) still move the column on.
function decodeMappings(mappings) {
  let line = 0;
  let originalColumn = 0;
  return mappings.split(';').map((text) => {
    let column = 0;
    const segments = [];
    text
      .split(',')
      .filter(Boolean)
      .forEach((part) => {
        const values = decodeSegment(part);
        column += values[0];
        if (values.length >= 4) {
          line += values[2];
          originalColumn += values[3];
          segments.push({ column, line, originalColumn });
        }
      });
    return segments;
  });
}

// Line starts of the code each file ran as, which the loader's own rewrites (on the lines they were) may make
// longer than the compiler's output; recorded only while coverage is collected.
const executed = new Map();

function recordExecuted(file, source) {
  executed.set(file, lineStarts(source));
}

// The coverage of a compiled file on its source, or null when it was not compiled with a map.
function remapCoverage(file, { counts, functions, blocks }) {
  const compiled = compiledCodeOf(file);
  const map = compiled && inlineMapOf(compiled);
  if (!map?.mappings) {
    return null;
  }
  let original;
  try {
    original = fs.readFileSync(file, 'utf8');
  } catch {
    return null;
  }
  const generated = decodeMappings(map.mappings);
  const ranStarts = executed.get(file) ?? lineStarts(compiled);
  const sourceStarts = lineStarts(original);
  const out = new Float64Array(original.length).fill(Number.NaN);
  generated.forEach((segments, line) => {
    const start = ranStarts[line];
    if (start === undefined) {
      return;
    }
    const lineEnd = ranStarts[line + 1] ?? counts.length;
    segments.forEach((segment, i) => {
      const from = start + segment.column;
      const to = i + 1 < segments.length ? start + segments[i + 1].column : lineEnd;
      const target = sourceStarts[segment.line] + segment.originalColumn;
      const targetEnd = sourceStarts[segment.line + 1] ?? original.length;
      for (let k = 0; from + k < to && target + k < targetEnd; k += 1) {
        const count = counts[from + k] ?? 0;
        const previous = out[target + k];
        out[target + k] = Number.isNaN(previous) ? count : Math.max(previous, count);
      }
    });
  });
  // A position of the code that ran, on the source.
  const at = (offset) => {
    let line = ranStarts.findLastIndex((lineStart) => lineStart <= offset);
    if (line < 0) {
      line = 0;
    }
    const column = offset - ranStarts[line];
    const segment = (generated[line] ?? []).findLast((one) => one.column <= column);
    return segment ? sourceStarts[segment.line] + segment.originalColumn + (column - segment.column) : null;
  };
  const moved = (entries) =>
    new Map(
      [...entries.values()]
        .map((entry) => ({ ...entry, startOffset: at(entry.startOffset), endOffset: at(entry.endOffset - 1) }))
        .filter((entry) => entry.startOffset !== null)
        .map((entry) => [`${entry.startOffset}:${entry.endOffset}`, { ...entry, endOffset: (entry.endOffset ?? entry.startOffset) + 1 }])
    );
  return { counts: out, functions: moved(functions), blocks: moved(blocks) };
}

module.exports = { remapCoverage, recordExecuted, decodeMappings };
