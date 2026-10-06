const fs = require('node:fs');
const path = require('node:path');

// --shard <index>/<total>: one slice of the suite per CI job, as in Jest and Vitest (index from 1). Every job
// computes the partition on its own, so it may only use what every machine has alike: the paths and sizes of the
// files of the checkout. Durations recorded by a previous run would balance better, but each runner has its own
// (or none), and two jobs with different ones would run some files twice and others never.

function parseShard(value) {
  const text = typeof value === 'object' && value !== null ? `${value.index}/${value.total}` : String(value);
  const match = /^\s*(\d+)\s*\/\s*(\d+)\s*$/.exec(text);
  const index = match ? Number(match[1]) : NaN;
  const total = match ? Number(match[2]) : NaN;
  if (!match || total < 1 || index < 1 || index > total) {
    throw new Error(`Invalid shard "${text}": expected <index>/<total>, with 1 <= index <= total (e.g. --shard 2/4)`);
  }
  return { index, total };
}

function sizeOf(file) {
  try {
    return fs.statSync(file).size;
  } catch {
    return 0;
  }
}

// The files of one shard, in the order they were given. Largest first, each file goes to the shard with the least
// bytes so far (the lowest index on a tie), which keeps shards close in size; a file's size stands in for its cost.
function selectShard(files, { index, total }, rootDir) {
  const toPosix = (file) => path.relative(rootDir, file).split(path.sep).join('/');
  const ordered = files
    .map((file) => ({ file, key: toPosix(file), size: sizeOf(file) }))
    .sort((a, b) => b.size - a.size || (a.key < b.key ? -1 : Number(a.key > b.key)));
  const loads = Array.from({ length: total }, () => 0);
  const mine = new Set();
  ordered.forEach(({ file, size }) => {
    const lightest = loads.indexOf(Math.min(...loads));
    loads[lightest] += size;
    if (lightest === index - 1) {
      mine.add(file);
    }
  });
  return files.filter((file) => mine.has(file));
}

module.exports = { parseShard, selectShard };
