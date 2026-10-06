const path = require('node:path');
const { Worker, MessageChannel, receiveMessageOnPort } = require('node:worker_threads');

// Node's module hooks are synchronous; some of what a project asks for is not (a Jest transformer with only
// processAsync, Vite plugins' async hooks). The bridge runs that on a thread of its own and waits for the answer:
// the calling thread blocks on a shared flag (Atomics.wait) until the helper sets it, then reads the reply
// straight from the port.

const TIMEOUT_MS = 120_000;
let bridge = null;

function start() {
  const shared = new Int32Array(new SharedArrayBuffer(4));
  const { port1, port2 } = new MessageChannel();
  const worker = new Worker(path.join(__dirname, 'bridge-worker.js'), {
    workerData: { shared, port: port2 },
    transferList: [port2],
  });
  // It must not keep the process alive once the run is over.
  worker.unref();
  return { worker, port: port1, shared };
}

// Calls a handler of bridge-worker.js and returns what it resolves with, or throws what it throws.
function callSync(method, ...args) {
  bridge ??= start();
  Atomics.store(bridge.shared, 0, 0);
  bridge.worker.postMessage({ method, args });
  if (Atomics.wait(bridge.shared, 0, 0, TIMEOUT_MS) === 'timed-out') {
    throw new Error(`The ${method} hook did not finish within ${TIMEOUT_MS / 1000}s`);
  }
  const { message } = receiveMessageOnPort(bridge.port);
  if (message.error) {
    const error = new Error(message.error.message);
    error.stack = message.error.stack;
    throw error;
  }
  return message.result;
}

module.exports = { callSync };
