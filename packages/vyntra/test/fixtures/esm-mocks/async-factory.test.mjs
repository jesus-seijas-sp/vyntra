// vi.doMock() with an async factory (importOriginal), then import(): the factory settles first, as in vitest.
test('an async doMock factory runs before the import() after it', async () => {
  vi.resetModules();
  vi.doMock('node:stream', async (importOriginal) => ({
    ...(await importOriginal()),
    finished: function mocked() {},
  }));
  const { kind } = await import('./lib/uses-stream.mjs');
  expect(kind()).toBe('mocked');
});
