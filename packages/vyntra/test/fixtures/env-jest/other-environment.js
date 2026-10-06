const NodeEnvironment = require('jest-environment-node');

module.exports = class OtherEnvironment extends NodeEnvironment {
  async setup() {
    this.global.other = true;
  }
};
