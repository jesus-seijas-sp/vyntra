const numbers = Array.from({ length: 1000 }, (_, i) => (i * 7919) % 1000);

describe('sorting', () => {
  bench('Array#sort', () => {
    [...numbers].sort((a, b) => a - b);
  }, { time: 50, warmupTime: 10 });

  bench('Float64Array#sort', () => {
    Float64Array.from(numbers).sort();
  }, { time: 50, warmupTime: 10 });

  bench.skip('skipped', () => {});
});

bench('async', async () => {
  await Promise.resolve();
}, { time: 30, iterations: 20, warmupTime: 5 });
