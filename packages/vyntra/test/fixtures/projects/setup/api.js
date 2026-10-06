const log = require('./log');

module.exports.setup = async ({ name }) => {
  log(`${name} setup`);
  if (process.env.API_SETUP_FAILS) {
    throw new Error('the api seed failed');
  }
  return { apiPort: 4000 };
};

module.exports.teardown = () => log('api teardown');
