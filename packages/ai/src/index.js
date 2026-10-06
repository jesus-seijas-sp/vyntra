const { fixtures } = require('./fixtures');
const { matchers } = require('./matchers');
const { Agent } = require('./agent');
const { AnthropicProvider } = require('./providers/anthropic');
const { secret, fillSecret } = require('./secrets');
const { unique } = require('./unique');
const { summarize } = require('./summary');
const { explore } = require('./explore');

// The AI engine of vyntra: a project with engine: 'ai' (or ['web', 'ai'], for the agent's page) gets the agent
// fixture, expect().toSatisfy(), and longer timeouts, as model calls take seconds when a step is recorded.
// The files the engine writes in the run's output directory, which the core clears when a run starts.
const outputs = ['ai-usage.jsonl', 'ai-trace.jsonl'];

const defaults = {
  testTimeout: 120_000,
  hookTimeout: 60_000,
};

module.exports = {
  fixtures,
  matchers,
  defaults,
  outputs,
  summarize,
  explore,
  Agent,
  AnthropicProvider,
  secret,
  fillSecret,
  unique,
};
