// The app the live sessions open: the config starts it, as for its tests.
const port = Number(process.env.APP_PORT ?? 4555);

module.exports = {
  server: { command: 'node server.js', url: `http://localhost:${port}/`, env: { PORT: String(port) } },
  use: { baseURL: `http://localhost:${port}` },
};
