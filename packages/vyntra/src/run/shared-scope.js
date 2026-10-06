// Teardowns in reverse order; returns the errors they throw.
async function runTeardowns(teardowns) {
  const errors = [];
  await teardowns
    .splice(0)
    .reduceRight(
      (prev, teardown) => prev.then(() => teardown().catch((error) => errors.push(error))),
      Promise.resolve()
    );
  return errors;
}

// The fixtures shared by the tests of a file, or of a worker: kept by name and definition, as every file loads its
// own copy of the module that defines them. A setup that failed stays failed, so the tests after it fail at once
// instead of trying again (a server that does not start, every time until its timeout).
class SharedScope {
  constructor() {
    this.entries = new Map();
    this.teardowns = [];
  }

  get(key, value, create) {
    const id = `${key}\0${typeof value === 'function' ? Function.prototype.toString.call(value) : ''}`;
    if (!this.entries.has(id)) {
      const entry = create(this.teardowns);
      entry.catch(() => {});
      this.entries.set(id, entry);
    }
    return this.entries.get(id);
  }

  teardown() {
    this.entries.clear();
    return runTeardowns(this.teardowns);
  }
}

module.exports = { SharedScope, runTeardowns };
