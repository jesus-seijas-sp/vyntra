// A vitest environment: setup gets the global object and the options under its name.
export default {
  name: 'greeting',
  transformMode: 'ssr',
  async setup(global, options) {
    global.greet = (name) => `${options.word}, ${name}`;
    return {
      teardown(teardownGlobal) {
        delete teardownGlobal.greet;
      },
    };
  },
};
