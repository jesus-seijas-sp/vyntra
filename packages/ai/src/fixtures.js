const { Agent } = require('./agent');
const { settingsOf } = require('./settings');

const fixtures = {
  // An agent on the test's page (from @vyntra/web, when the project has both engines). The page is set up only when a
  // test uses the agent. When the test ends, the acts a later check confirmed are recorded.
  agent: async ({ page, ai, testInfo }, use) => {
    const agent = new Agent(page, settingsOf(ai));
    await use(agent);
    agent.finish(testInfo.failed);
  },
};

module.exports = { fixtures };
