const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export default {
  plugins: [
    {
      name: 'virtual-greeting',
      resolveId(id) {
        return id === 'virtual:greeting' ? '\0virtual:greeting' : null;
      },
      async load(id) {
        await delay(5);
        return id === '\0virtual:greeting' ? 'export default "hello from a virtual module";' : null;
      },
    },
    {
      name: 'async-transform',
      async transform(code, id) {
        await delay(5);
        return id.endsWith('async.test.js') ? code.replaceAll('__ASYNC__', JSON.stringify('rewritten asynchronously')) : null;
      },
    },
  ],
  test: {},
};
