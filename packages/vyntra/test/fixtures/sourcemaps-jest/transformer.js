const { transformSync } = require('../sourcemaps/node_modules/esbuild');

// A Jest transformer that returns its source map beside the code, as babel-jest can, instead of inline.
module.exports = {
  process(source, filename) {
    const { code } = transformSync(source, { sourcefile: filename });
    const [body, inline] = code.split('//# sourceMappingURL=data:application/json;base64,');
    return { code: body, map: JSON.parse(Buffer.from(inline.trim(), 'base64').toString()) };
  },
};
