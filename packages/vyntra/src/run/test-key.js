// A test's identity across runs: its describe blocks and name.
const testKey = (titlePath) => titlePath.join(' > ');

module.exports = { testKey };
