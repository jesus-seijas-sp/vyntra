const NodeEnvironment = require('jest-environment-node').TestEnvironment;

// A Jest environment: a class over NodeEnvironment that puts a connection on the tests' global.
class DatabaseEnvironment extends NodeEnvironment {
  constructor(config, context) {
    super(config, context);
    this.database = config.projectConfig.testEnvironmentOptions.database;
    this.testPath = context.testPath;
  }

  async setup() {
    await super.setup();
    this.global.db = { name: this.database, file: require('node:path').basename(this.testPath) };
  }

  async teardown() {
    this.global.db = null;
    await super.teardown();
  }
}

module.exports = DatabaseEnvironment;
