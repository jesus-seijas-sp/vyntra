const { test: base } = require('vyntra');

// Counts setups and teardowns across files: on process, which outlives the modules and globals of each file.
process.scopeCounts ??= { worker: 0, file: 0, test: 0, workerDown: 0 };
const counts = process.scopeCounts;

const test = base.extend({
  // An option: the default here, the config's `use` overrides it.
  greeting: ['hello', { option: true }],
  database: [
    async ({ baseURL }, use) => {
      counts.worker += 1;
      await use({ url: `${baseURL}/db`, id: counts.worker });
      counts.workerDown += 1;
    },
    { scope: 'worker' },
  ],
  table: [
    async ({ database }, use) => {
      counts.file += 1;
      await use(`${database.url}/table-${counts.file}`);
    },
    { scope: 'file' },
  ],
  row: async ({ table }, use) => {
    counts.test += 1;
    await use(`${table}/row-${counts.test}`);
  },
});

module.exports = { test, counts };
