export default {
  test: {
    include: ['**/*.test.js'],
    browser: { enabled: true, provider: 'playwright', instances: [{ browser: 'chromium' }] },
  },
};
