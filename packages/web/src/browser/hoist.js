const Module = require('node:module');
const path = require('node:path');

// vyntra's own hoisting of vi.mock calls (vyntra/src/modules/hoist.js), from the vyntra that runs.
let hoist = null;

function hoistMocks(source, options) {
  if (!hoist) {
    let manifest;
    try {
      manifest = Module.createRequire(path.join(process.cwd(), 'package.json')).resolve('vyntra/package.json');
    } catch {
      manifest = require.resolve('vyntra/package.json');
    }
    // eslint-disable-next-line global-require -- vyntra's internals, by path
    hoist = require(path.join(path.dirname(manifest), 'src', 'modules', 'hoist.js')).hoistMocks;
  }
  return hoist(source, options);
}

module.exports = { hoistMocks };
