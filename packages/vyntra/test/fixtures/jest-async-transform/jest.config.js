module.exports = {
  transform: { '\\.js$': '<rootDir>/async-transformer.js' },
  transformIgnorePatterns: ['<rootDir>/async-transformer\\.js$', '/node_modules/'],
};
