const { pathToFileURL } = require('node:url');

// globalSetup files, as Jest and vitest run them: once, in the main process, before the files of the project.
// A file exports a function (default, or `setup`) that may return its teardown, or values for the tests, which read
// them with inject(); provide(key, value) gives them too, as vitest's does. `teardown`, if exported, runs after.

// A setup that threw, and the file it is in.
class GlobalSetupError extends Error {
  constructor(file, original) {
    super(original?.message ?? String(original));
    this.setupFile = file;
    this.original = original;
  }
}

async function importSetup(file) {
  const loaded = await import(pathToFileURL(file).href);
  const setup = loaded.setup ?? (typeof loaded.default === 'function' ? loaded.default : loaded.default?.setup);
  const teardown = loaded.teardown ?? loaded.default?.teardown;
  return { setup, teardown };
}

// Values cross to the workers by structured clone: anything else is refused here, where it was provided.
function checkProvided(key, value) {
  try {
    structuredClone(value);
  } catch {
    throw new Error(`The value provided as "${key}" can not reach the tests: provide data (no functions, no sockets)`);
  }
}

const inOrder = (items, fn) => items.reduce((prev, item) => prev.then(() => fn(item)), Promise.resolve());

// The setups' teardowns in reverse order, then the globalTeardown files; returns the errors they throw.
async function runGlobalTeardown(files, teardowns) {
  const errors = [];
  const attempt = (fn) =>
    Promise.resolve()
      .then(fn)
      .catch((error) => errors.push(error));
  await inOrder([...teardowns].reverse(), attempt);
  await inOrder(files, (file) =>
    attempt(async () => {
      const { setup, teardown } = await importSetup(file);
      await (teardown ?? setup)?.();
    })
  );
  return errors;
}

// Runs the setup files in order; returns { provided, teardowns }. A setup that throws stops there, after the
// teardowns of those before it.
async function runGlobalSetup(files, { config, name }) {
  const provided = {};
  const teardowns = [];
  const provide = (key, value) => {
    checkProvided(key, value);
    provided[key] = value;
  };
  const setUp = async (file) => {
    let loaded;
    let result;
    try {
      loaded = await importSetup(file);
      result = loaded.setup ? await loaded.setup({ provide, config, name }) : undefined;
      if (result && typeof result === 'object') {
        Object.entries(result).forEach(([key, value]) => provide(key, value));
      }
    } catch (error) {
      throw new GlobalSetupError(file, error);
    }
    if (typeof result === 'function') {
      teardowns.push(result);
    }
    if (loaded.teardown) {
      teardowns.push(loaded.teardown);
    }
  };
  try {
    await inOrder(files, setUp);
  } catch (error) {
    await runGlobalTeardown([], teardowns);
    throw error;
  }
  return { provided, teardowns };
}

module.exports = { runGlobalSetup, runGlobalTeardown };
