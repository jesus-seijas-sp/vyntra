const state = require('../state');

// A global function, bound to the global object: a browser's refuses to run detached from window.
const own = (name) => globalThis[name]?.bind(globalThis);

// The real timer functions, taken before any test can fake them. The runner uses them for its own timeouts. A
// browser (browser mode) has no setImmediate: a timeout stands in for it.
state.realTimers ??= {
  setTimeout: own('setTimeout'),
  clearTimeout: own('clearTimeout'),
  setInterval: own('setInterval'),
  clearInterval: own('clearInterval'),
  setImmediate: own('setImmediate') ?? ((fn, ...args) => globalThis.setTimeout(fn, 0, ...args)),
  clearImmediate: own('clearImmediate') ?? own('clearTimeout'),
  queueMicrotask: own('queueMicrotask'),
  nextTick: process.nextTick ?? ((fn, ...args) => queueMicrotask(() => fn(...args))),
  Date: globalThis.Date,
  performanceNow: performance.now.bind(performance),
};

const { realTimers } = state;

// Lets pending promise callbacks run: a macrotask boundary drains the microtask queue.
const flushMicrotasks = () =>
  new Promise((resolve) => {
    realTimers.setImmediate(resolve);
  });

module.exports = { realTimers, flushMicrotasks };
