const { realTimers } = require('../timers/real-timers');

// One benchmark, as tinybench (vitest's) measures it: a warmup, then one sample per call until both the time and
// the number of iterations asked for are reached. A function that returns no promise is called in a loop of its
// own, as awaiting each call would add its cost to what is measured.

const now = () => realTimers.performanceNow();

// Two-sided critical values of Student's t at 95%, by degrees of freedom; past 30, the normal's.
const T_TABLE = [
  12.706, 4.303, 3.182, 2.776, 2.571, 2.447, 2.365, 2.306, 2.262, 2.228, 2.201, 2.179, 2.16, 2.145, 2.131, 2.12, 2.11,
  2.101, 2.093, 2.086, 2.08, 2.074, 2.069, 2.064, 2.06, 2.056, 2.052, 2.048, 2.045, 2.042,
];
const critical = (df) => T_TABLE[df - 1] ?? 1.96;

const quantile = (sorted, q) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(q * sorted.length) - 1))];

function statistics(samples, totalTime) {
  const sorted = [...samples].sort((a, b) => a - b);
  const n = sorted.length;
  const mean = sorted.reduce((sum, value) => sum + value, 0) / n;
  const variance = n > 1 ? sorted.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (n - 1) : 0;
  const sd = Math.sqrt(variance);
  const sem = sd / Math.sqrt(n);
  return {
    hz: mean > 0 ? 1000 / mean : Infinity,
    min: sorted[0],
    max: sorted[n - 1],
    mean,
    p75: quantile(sorted, 0.75),
    p99: quantile(sorted, 0.99),
    p995: quantile(sorted, 0.995),
    p999: quantile(sorted, 0.999),
    sd,
    rme: mean > 0 ? ((critical(n - 1) * sem) / mean) * 100 : 0,
    samples: n,
    totalTime,
  };
}

async function measure(fn, options = {}) {
  const { time = 500, iterations = 10, warmupTime = 100, warmupIterations = 5, setup, teardown } = options;
  await setup?.();
  try {
    // The first call says whether the function is async.
    const first = fn();
    const isAsync = typeof first?.then === 'function';
    await first;
    const call = isAsync ? () => fn() : null;
    let start = now();
    for (let n = 1; n < warmupIterations || now() - start < warmupTime; n += 1) {
      if (isAsync) {
        await call(); // eslint-disable-line no-await-in-loop -- one call after the other
      } else {
        fn();
      }
    }
    const samples = [];
    start = now();
    while (samples.length < iterations || now() - start < time) {
      const before = now();
      if (isAsync) {
        await call(); // eslint-disable-line no-await-in-loop
      } else {
        fn();
      }
      samples.push(now() - before);
    }
    return statistics(samples, now() - start);
  } finally {
    await teardown?.();
  }
}

module.exports = { measure, statistics };
