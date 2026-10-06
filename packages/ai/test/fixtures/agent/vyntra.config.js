const path = require('node:path');

module.exports = {
  engine: [path.join(__dirname, '../../../../web/src/index.js'), path.join(__dirname, '../../../src/index.js')],
  include: ['*.e2e.js'],
  retry: 0,
  use: {
    ai: {
      provider: './fake-provider.js',
      actionTimeout: 500,
      model: process.env.AI_MODEL,
      judge: process.env.AI_JUDGE,
      context: process.env.AI_CONTEXT,
      system: process.env.AI_SYSTEM,
    },
  },
};
