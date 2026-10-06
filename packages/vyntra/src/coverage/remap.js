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

// Per generated line, its segments in order: { column, source, line, originalColumn } (0-based). Segments without
// a source (only a column) still move the column on.
function decodeMappings(mappings) {
  let source = 0;
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
          source += values[1];
          line += values[2];
          originalColumn += values[3];
          segments.push({ column, source, line, originalColumn });
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

// Moves the coverage of code that ran (its line starts: ranStarts) through its map's segments onto the sources
// ([{ text, starts }], by the map's source index; null for one left out): [{ counts, functions, blocks }] by index.
// skip(segment, from, to): a span of the code that ran that is not the source's, though mapped onto it.
function project({ counts, functions, blocks }, generated, ranStarts, sources, skip = () => false) {
  const out = sources.map((source) => source && new Float64Array(source.text.length).fill(Number.NaN));
  generated.forEach((segments, line) => {
    const start = ranStarts[line];
    if (start === undefined) {
      return;
    }
    const lineEnd = ranStarts[line + 1] ?? counts.length;
    segments.forEach((segment, i) => {
      const source = sources[segment.source];
      if (!source) {
        return;
      }
      const into = out[segment.source];
      const from = start + segment.column;
      const to = i + 1 < segments.length ? start + segments[i + 1].column : lineEnd;
      if (skip(segment, from, to)) {
        return;
      }
      const target = source.starts[segment.line] + segment.originalColumn;
      const targetEnd = source.starts[segment.line + 1] ?? source.text.length;
      for (let k = 0; from + k < to && target + k < targetEnd; k += 1) {
        const count = counts[from + k] ?? 0;
        const previous = into[target + k];
        into[target + k] = Number.isNaN(previous) ? count : Math.max(previous, count);
      }
    });
  });
  // A position of the code that ran, on a source: { source, offset }.
  const at = (offset) => {
    let line = ranStarts.findLastIndex((lineStart) => lineStart <= offset);
    if (line < 0) {
      line = 0;
    }
    const column = offset - ranStarts[line];
    const segments = generated[line] ?? [];
    const index = segments.findLastIndex((one) => one.column <= column);
    const segment = segments[index];
    const source = segment && sources[segment.source];
    const end = index + 1 < segments.length ? ranStarts[line] + segments[index + 1].column : ranStarts[line + 1];
    return source && !skip(segment, ranStarts[line] + segment.column, end ?? counts.length)
      ? { source: segment.source, offset: source.starts[segment.line] + segment.originalColumn + (column - segment.column) }
      : null;
  };
  const moved = (entries, index) =>
    new Map(
      [...entries.values()]
        .map((entry) => ({ entry, start: at(entry.startOffset), end: at(entry.endOffset - 1) }))
        .filter(({ start }) => start?.source === index)
        .map(({ entry, start, end }) => {
          const endOffset = (end?.source === index ? end.offset : start.offset) + 1;
          return [`${start.offset}:${endOffset}`, { ...entry, startOffset: start.offset, endOffset }];
        })
    );
  // The module is a function covering the whole script, not one of the files' functions.
  const own = new Map(
    [...functions].filter(([, fn]) => !(fn.startOffset === 0 && fn.endOffset >= counts.length))
  );
  return out.map(
    (sourceCounts, index) =>
      sourceCounts && { counts: sourceCounts, functions: moved(own, index), blocks: moved(blocks, index) }
  );
}

// The coverage of a compiled file on its source, or null when it was not compiled with a map.
function remapCoverage(file, coverage) {
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
  // A compiler's map of one file: its segments are all of source 0.
  return project(coverage, generated, ranStarts, [{ text: original, starts: lineStarts(original) }])[0];
}

// The coverage of a bundle (browser mode) on the files it was built from: { file: coverage } for those keep(file)
// accepts. map: the bundle's source map, its sources already resolved to paths.
function remapBundle(code, map, coverage, keep) {
  const sources = map.sources.map((file) => {
    if (!file || !keep(file)) {
      return null;
    }
    try {
      const text = fs.readFileSync(file, 'utf8');
      return { text, starts: lineStarts(text) };
    } catch {
      return null;
    }
  });
  // esbuild maps the wrappers of the modules it imports lazily (var init_x = __esm({ "x.js"() {) onto their
  // first character: code there that is not the file's own text is the bundle's.
  const wrapper = (segment, from, to) => {
    if (segment.line !== 0 || segment.originalColumn !== 0) {
      return false;
    }
    const ran = code.slice(from, to).trimEnd();
    return !sources[segment.source].text.startsWith(ran.slice(0, Math.max(1, ran.search(/\W|$/))));
  };
  const projected = project(coverage, decodeMappings(map.mappings), lineStarts(code), sources, wrapper);
  return new Map(map.sources.map((file, index) => [file, projected[index]]).filter(([, one]) => one));
}

module.exports = { remapCoverage, remapBundle, recordExecuted, decodeMappings };
