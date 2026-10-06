// Every test records the thread that ran it: run in parts, the file uses several.
const { threadId } = require('node:worker_threads');

let setups = 0;
beforeAll(() => {
  setups += 1;
});

describe('independent tests', () => {
  // Long enough that the other workers take parts while one runs, however quickly the first one started.
  it.each([0, 1, 2, 3, 4, 5])('test %i', async (index) => {
    expect(setups).toBe(1);
    console.log(`test ${index} on thread ${threadId}`);
    await new Promise((resolve) => {
      setTimeout(resolve, 300);
    });
  });
});
