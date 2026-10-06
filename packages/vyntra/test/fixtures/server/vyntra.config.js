const port = process.env.APP_PORT;

module.exports = {
  server: {
    command: 'node app.js',
    url: `http://localhost:${port}/health`,
    env: { PORT: port },
    timeout: Number(process.env.APP_TIMEOUT ?? 10_000),
    reuseExisting: Boolean(process.env.APP_REUSE),
  },
};
