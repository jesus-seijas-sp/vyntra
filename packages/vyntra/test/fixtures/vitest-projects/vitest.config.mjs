export default {
  test: {
    setupFiles: ['./setup.js'],
    projects: [
      'packages/*',
      { extends: true, test: { name: 'inline', include: ['inline/**/*.test.js'] } },
    ],
  },
};
