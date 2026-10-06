const path = require('node:path');

module.exports = {
  engine: [path.join(__dirname, '../../../../web/src/index.js'), path.join(__dirname, '../../../src/index.js')],
  include: ['*.e2e.js'],
  retry: 0,
  use: { ai: { provider: './fake-provider.js', actionTimeout: 500 } },
};
