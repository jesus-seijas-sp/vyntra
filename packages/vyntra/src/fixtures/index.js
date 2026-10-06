const state = require('../state');

// The fixtures every test can destructure without test.extend(): set up only for the tests that ask for them.
const builtins = {
  // The project's server (or the run's): { url, name, reused }.
  server: [
    async (_, use) => {
      const info = state.config?.serverInfo;
      if (!info) {
        throw new Error('There is no server: set `server` in the config, or in the project, to start one');
      }
      await use(info);
    },
    { scope: 'worker' },
  ],
};

module.exports = { builtins };
