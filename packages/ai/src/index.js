const { fixtures } = require('./fixtures');
const { matchers } = require('./matchers');
const { Agent } = require('./agent');
const { AnthropicProvider } = require('./providers/anthropic');
const { secret, fillSecret } = require('./secrets');
const { unique } = require('./unique');

// The AI engine of vyntra: a project with engine: 'ai' (or ['web', 'ai'], for the agent's page) gets the agent
// fixture, expect().toSatisfy(), and longer timeouts, as model calls take seconds when a step is recorded.
const defaults = {
  testTimeout: 120_000,
  hookTimeout: 60_000,
};

module.exports = { fixtures, matchers, defaults, Agent, AnthropicProvider, secret, fillSecret, unique };
