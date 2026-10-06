const { createRuntime } = require('../runtime');

// Everything in the main thread: no worker startup, the fastest option for a handful of small files. Same interface
// as the WorkerPool: run(jobs) resolves with what was collected (coverage), stop() skips the jobs left.
class InlineRunner {
  constructor({ config, onResult }) {
    this.config = config;
    this.onResult = onResult;
    this.stopped = false;
  }

  async run(jobs) {
    const { run, finish } = await createRuntime(this.config);
    await jobs.reduce(
      (prev, job) => prev.then(async () => (this.stopped ? undefined : this.onResult(await run(job.path, job.shard)))),
      Promise.resolve()
    );
    return [await finish()];
  }

  stop() {
    this.stopped = true;
  }
}

module.exports = { InlineRunner };
