const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { parseShard, selectShard } = require('../src/cli/select-shard');
const { runFixture } = require('./helpers/run-fixture');

describe('parseShard', () => {
  it('reads <index>/<total>, with the index from 1', () => {
    expect(parseShard('2/4')).toEqual({ index: 2, total: 4 });
    expect(parseShard('1/1')).toEqual({ index: 1, total: 1 });
    expect(parseShard({ index: 3, total: 3 })).toEqual({ index: 3, total: 3 });
  });

  it.each(['0/4', '5/4', '1/0', '2', 'a/b', '-1/2', '1.5/2', ''])('rejects %j', (value) => {
    expect(() => parseShard(value)).toThrow('Invalid shard');
  });
});

describe('selectShard', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vyntra-shard-'));
  const sizes = [900, 50, 400, 400, 120, 10, 700, 0, 330, 260, 75];
  const files = sizes.map((size, i) => {
    const file = path.join(root, `f${i}.test.js`);
    fs.writeFileSync(file, 'x'.repeat(size));
    return file;
  });
  const shards = (total) => Array.from({ length: total }, (_, i) => selectShard(files, { index: i + 1, total }, root));

  it.each([1, 2, 3, 4, 11, 15])('puts every file in exactly one of %i shards', (total) => {
    const all = shards(total).flat();
    expect(all).toHaveLength(files.length);
    expect(new Set(all)).toEqual(new Set(files));
  });

  it('keeps the order the files were given in', () => {
    shards(3).forEach((shard) => {
      expect(shard).toEqual(files.filter((file) => shard.includes(file)));
    });
  });

  it('does not depend on the order the files were given in', () => {
    const reversed = [...files].reverse();
    const again = Array.from({ length: 3 }, (_, i) => selectShard(reversed, { index: i + 1, total: 3 }, root));
    expect(again.map((shard) => new Set(shard))).toEqual(shards(3).map((shard) => new Set(shard)));
  });

  it('balances the shards by size', () => {
    const bytes = shards(3).map((shard) => shard.reduce((sum, file) => sum + fs.statSync(file).size, 0));
    expect(Math.max(...bytes) - Math.min(...bytes)).toBeLessThanOrEqual(Math.max(...sizes));
  });

  it('leaves shards empty when there are more shards than files', () => {
    expect(shards(15).filter((shard) => shard.length === 0)).toHaveLength(4);
  });
});

describe('--shard', () => {
  const names = (report) => report.files.map((file) => path.basename(file.path)).sort();

  it('runs each file in exactly one shard', () => {
    const runs = [1, 2, 3].map((index) => names(runFixture('shard', ['--shard', `${index}/3`])));
    runs.forEach((run) => expect(run.length).toBeGreaterThan(0));
    expect(runs.flat().sort()).toEqual([
      'file1.test.js',
      'file2.test.js',
      'file3.test.js',
      'file4.test.js',
      'file5.test.js',
    ]);
  });

  it('fails an empty shard unless passWithNoTests', () => {
    const bin = path.join(__dirname, '..', 'bin', 'vyntra.js');
    const root = path.join(__dirname, 'fixtures', 'shard');
    const run = (...args) =>
      spawnSync(process.execPath, [bin, '--root', root, '--no-color', ...args], { encoding: 'utf8' });
    const empty = run('--shard', '6/6');
    expect(empty.status).toBe(1);
    expect(empty.stdout).toContain('No test files found in shard 6/6 (of 5)');
    expect(run('--shard', '6/6', '--passWithNoTests').status).toBe(0);
    const invalid = run('--shard', '7/6');
    expect(invalid.status).toBe(1);
    expect(invalid.stderr).toContain('Invalid shard "7/6"');
  });
});
