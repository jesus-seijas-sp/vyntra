const { test: base } = require('vyntra');

let setups = 0;

const test = base.extend({
  broken: [
    async (_, use) => {
      setups += 1;
      throw new Error(`setup ${setups} failed`);
      // eslint-disable-next-line no-unreachable
      await use(1);
    },
    { scope: 'worker' },
  ],
  perTest: async ({}, use) => use(1),
  leaky: [async ({ perTest }, use) => use(perTest), { scope: 'worker' }],
  closing: [
    async ({}, use) => {
      await use(1);
      throw new Error('teardown failed');
    },
    { scope: 'worker' },
  ],
});

test('fails with the setup error', ({ broken }) => expect(broken).toBe(1));
test('fails at once with the same error', ({ broken }) => expect(broken).toBe(1));
test('a worker fixture can not use a test fixture', ({ leaky }) => expect(leaky).toBe(1));
test('uses a fixture whose teardown fails', ({ closing }) => expect(closing).toBe(1));
