const path = require('node:path');

const port = Number(process.env.APP_PORT ?? 4556);

module.exports = {
  engine: [path.join(__dirname, '../../../../web/src/index.js'), path.join(__dirname, '../../../src/index.js')],
  server: { command: 'node server.js', url: `http://localhost:${port}/`, env: { PORT: String(port), BUG: process.env.BUG ?? '' } },
  use: { baseURL: `http://localhost:${port}`, ai: { provider: './fake-provider.js', actionTimeout: 500 } },
};
