// One config for every kind of test of the app: unit tests of its logic, API tests, end-to-end tests in a browser,
// and steps in words an AI agent takes, against the server vyntra starts for them.
const port = Number(process.env.PORT ?? 4321);

module.exports = {
  server: {
    command: 'node server.js',
    url: `http://localhost:${port}/health`,
    env: { PORT: String(port) },
    reuseExisting: !process.env.CI,
  },
  use: { baseURL: `http://localhost:${port}` },
  projects: [
    { name: 'unit', include: ['src/**/*.test.mjs'] },
    { name: 'api', include: ['test/api/**/*.test.js'], dependsOn: ['unit'] },
    { name: 'e2e', include: ['test/e2e/**/*.e2e.js'], engine: 'web', dependsOn: ['api'] },
    { name: 'ai', include: ['test/ai/**/*.e2e.js'], engine: ['web', 'ai'], dependsOn: ['api'] },
  ],
};
