const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { writeSuite } = require('../bench/suite');
const { mannWhitney, wilcoxon, median } = require('../bench/gate');

describe('benchmark gate statistics', () => {
  const base = [100, 102, 98, 101, 99, 100, 103, 97, 100, 101];

  it('finds no difference between the same times', () => {
    expect(mannWhitney(base, base)).toBeGreaterThan(0.4);
    expect(wilcoxon(base, base)).toBe(1);
  });

  it('finds a slowdown that is not noise', () => {
    const slower = base.map((value) => value * 1.1);
    expect(mannWhitney(base, slower)).toBeLessThan(0.01);
    expect(wilcoxon(base, slower)).toBeLessThan(0.01);
  });

  it('does not take a speedup for a slowdown', () => {
    const faster = base.map((value) => value * 0.9);
    expect(mannWhitney(base, faster)).toBeGreaterThan(0.99);
    expect(wilcoxon(base, faster)).toBeGreaterThan(0.99);
  });

  it('takes the middle value', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });
});

describe('benchmark suite', () => {
  it('is the same every time', () => {
    const read = (dir) =>
      fs
        .readdirSync(path.join(dir, 'test'))
        .sort()
        .map((file) => fs.readFileSync(path.join(dir, 'test', file), 'utf8'))
        .join('\n');
    const first = fs.mkdtempSync(path.join(os.tmpdir(), 'vyntra-suite-'));
    const second = fs.mkdtempSync(path.join(os.tmpdir(), 'vyntra-suite-'));
    expect(writeSuite(first)).toEqual({ files: 200, tests: 3000 });
    writeSuite(second);
    expect(read(first)).toBe(read(second));
  });
});
