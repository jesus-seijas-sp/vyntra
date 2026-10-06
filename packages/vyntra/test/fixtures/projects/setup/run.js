const log = require('./log');

module.exports = async ({ provide }) => {
  log('run setup');
  provide('runValue', 42);
  return () => log('run teardown');
};
