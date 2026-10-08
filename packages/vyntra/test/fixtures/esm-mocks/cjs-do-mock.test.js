// A CommonJS test file mocks a builtin for the ES modules it imports, even one it loaded before the mock.
const stream = require('node:stream');
const first = require('./lib/uses-stream.mjs');

test('a CommonJS test mocks a builtin for the ES modules it imports', async () => {
  expect(first.kind()).toBe(stream.finished.name);
  vi.resetModules();
  vi.doMock('node:stream', () => ({
    ...stream,
    finished: function mocked() {},
  }));
  const { kind } = await import('./lib/uses-stream.mjs');
  expect(kind()).toBe('mocked');
});
