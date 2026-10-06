const { fixtures } = require('./fixtures');
const { matchers } = require('./matchers');

// The web engine of vyntra: a project with engine: 'web' gets these fixtures (browser, context, page), these
// matchers, and these defaults under the options it sets itself.
const defaults = {
  // A process per worker: browsers and the servers tests talk to are processes too.
  pool: 'forks',
  // Browsers are heavy: half the cores.
  maxWorkers: '50%',
  retry: 1,
  testTimeout: 30_000,
  hookTimeout: 30_000,
  environment: 'node',
  use: { browserName: 'chromium', headless: true, trace: 'on-failure', screenshot: 'only-on-failure' },
};

module.exports = { fixtures, matchers, defaults };
