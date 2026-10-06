const state = require('../state');
const { ApiClient } = require('../api/client');

// The origin of the project's server: the api fixture's base URL when use.baseURL is not set.
const serverOrigin = () => {
  const url = state.config?.serverInfo?.url;
  return url ? new URL(url).origin : undefined;
};

// The fixtures every test can destructure without test.extend(): set up only for the tests that ask for them.
const builtins = {
  // An HTTP client for the test: JSON, use.baseURL (or the server's origin), cookies and headers kept for the test,
  // every exchange recorded for the failure page.
  api: async ({ baseURL }, use) => {
    const { test } = state;
    await use(
      new ApiClient({
        baseURL: baseURL ?? serverOrigin(),
        record: (exchange) => test?.exchanges.push(exchange),
        signal: test?.abort.signal,
      })
    );
  },
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
