// The agent benchmark: the deterministic suite is the floor (it gates every change), the agent suite measures the
// agent against it, live, with a model (pnpm agent, then pnpm scorecard).
const port = Number(process.env.PORT ?? 4700);

module.exports = {
  server: {
    command: 'node server.js',
    url: `http://localhost:${port}/`,
    env: { PORT: String(port) },
    reuseExisting: !process.env.CI,
  },
  use: { baseURL: `http://localhost:${port}` },
  projects: [
    { name: 'deterministic', include: ['tests/**/*.e2e.js'], engine: 'web', retry: 0 },
    // Every scenario is tried once: a retry would hide what the agent can not do.
    { name: 'agent', include: ['tests-agent/**/*.e2e.js'], engine: ['web', 'ai'], retry: 0 },
  ],
};
