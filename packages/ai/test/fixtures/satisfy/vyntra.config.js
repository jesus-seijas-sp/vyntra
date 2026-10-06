const path = require('node:path');

module.exports = {
  engine: path.join(__dirname, '../../../src/index.js'),
  include: ['*.test.js'],
  use: {
    ai: {
      provider: './fake-provider.js',
      ...(process.env.AI_CALLS ? { budget: { calls: Number(process.env.AI_CALLS) } } : {}),
    },
  },
};
