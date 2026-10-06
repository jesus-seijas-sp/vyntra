// A Jest transformer with only processAsync, as some ESM-first ones are.
module.exports = {
  async processAsync(source) {
    await new Promise((resolve) => {
      setTimeout(resolve, 5);
    });
    return { code: source.replaceAll('__TRANSFORMED__', JSON.stringify('by processAsync')) };
  },
};
