module.exports = {
  globalSetup: './setup/run.js',
  use: { greeting: 'top' },
  projects: [
    {
      name: 'unit',
      include: ['unit/**/*.test.js', 'shared.test.js'],
      setupFiles: ['./setup/unit-setup.js'],
    },
    {
      name: 'api',
      include: ['api/**/*.test.js', 'shared.test.js'],
      globalSetup: './setup/api.js',
      use: { greeting: 'api' },
      dependsOn: ['unit'],
    },
    { name: 'e2e', include: ['e2e/**/*.test.{js,mjs}'], dependsOn: ['api'] },
  ],
};
