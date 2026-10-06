const fs = require('node:fs');
const path = require('node:path');

// Where page.screenshot() saves: vitest's place, __screenshots__/<test file>/, next to the test, or the path asked.
let shots = 0;

function screenshotPath(file, options = {}) {
  shots += 1;
  const shotFile =
    options.path ?? path.join(path.dirname(file), '__screenshots__', path.basename(file), `screenshot-${shots}.png`);
  const target = path.resolve(path.dirname(file), shotFile);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  return target;
}

// What page.screenshot() gives the test: the path from the root, and the image too when asked for base64.
function screenshotResult(rootDir, target, options = {}) {
  const relative = path.relative(rootDir, target);
  return options.base64 ? { path: relative, base64: fs.readFileSync(target).toString('base64') } : relative;
}

module.exports = { screenshotPath, screenshotResult };
