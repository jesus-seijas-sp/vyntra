module.exports = {
  transform: { '\\.js$': '<rootDir>/transformer.js' },
  transformIgnorePatterns: ['<rootDir>/transformer\\.js$', '/node_modules/'],
};
