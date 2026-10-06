const fs = require('node:fs');

// Where the setups write what they did, in order: the test reads it after the run.
module.exports = (line) => {
  if (process.env.SETUP_LOG) {
    fs.appendFileSync(process.env.SETUP_LOG, `${line}\n`);
  }
};
