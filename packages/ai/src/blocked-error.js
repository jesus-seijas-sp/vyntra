// The phase each reason for giving up has in the run's exit code: the environment's (3), the setup's (2), or the
// test's (1, no phase).
const PHASES = { environment: 'environment', credentials: 'setup', setup: 'setup' };

// An act the agent gave up on, with why: AGENT_BLOCKED_ENVIRONMENT and the like. A problem of the environment or of
// the setup is not a failure of the product, and the run's exit code says so.
class BlockedError extends Error {
  constructor(message, category = 'product') {
    super(message);
    this.name = 'BlockedError';
    this.category = category;
    this.code = `AGENT_BLOCKED_${category.toUpperCase()}`;
    if (PHASES[category]) {
      this.phase = PHASES[category];
    }
  }
}

module.exports = { BlockedError };
