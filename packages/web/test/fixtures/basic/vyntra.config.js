const path = require('node:path');

module.exports = {
  engine: path.join(__dirname, '../../../src/index.js'),
  include: ['*.e2e.js'],
};
