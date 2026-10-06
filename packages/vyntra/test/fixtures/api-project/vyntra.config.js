const port = process.env.APP_PORT;

module.exports = {
  projects: [
    { name: 'unit', include: ['src/**/*.test.js'] },
    {
      name: 'api',
      include: ['api/**/*.test.js'],
      server: { command: 'node app.js', url: `http://localhost:${port}/health`, env: { PORT: port } },
      use: { baseURL: `http://localhost:${port}/api` },
      dependsOn: ['unit'],
    },
  ],
};
