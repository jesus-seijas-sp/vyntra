const { SnapshotState } = require('../snapshot/snapshot-state');
const { readSnapshotFile } = require('../snapshot/snapshot-file');
const { serializeError } = require('../run/serialize-error');
const { userFrames, samePath } = require('../utils/stack');

// The Node side of a browser page's run (used by @vyntra/web): what the page needs from the file system before it
// starts, and what it sent back, written there.

// What the page's config adds to the project's.
function pageConfig(file, config) {
  return {
    browserMode: true,
    update: Boolean(config.update),
    ci: config.ci ?? Boolean(process.env.CI),
    snapshotStyle: config.snapshotStyle,
    storedSnapshots: readSnapshotFile(SnapshotState.pathFor(file)),
  };
}

// The page's snapshots, saved as a Node worker saves them; mapStack reads the page's stacks back onto the files, to
// find the toMatchInlineSnapshot() calls to write into.
function saveSnapshots(result, config, mapStack) {
  const { snapshotState, ...rest } = result;
  if (!snapshotState) {
    return rest;
  }
  const errors = [...rest.errors];
  let snapshot = null;
  try {
    const inlineUpdates = snapshotState.inlineUpdates.map(({ stack, ...update }) => {
      const frame = userFrames(mapStack(stack)).find(({ file }) => samePath(file, result.path));
      if (!frame) {
        throw new Error(`${update.matcher}() must be called in the test file itself`);
      }
      return { ...update, line: frame.line, column: frame.column };
    });
    const state = SnapshotState.restore(
      result.path,
      { update: Boolean(config.update), ci: config.ci ?? Boolean(process.env.CI) },
      { ...snapshotState, inlineUpdates }
    );
    const complete = rest.tests.every((test) => ['passed', 'flaky', 'failed'].includes(test.status));
    snapshot = state.save(complete, rest.tests);
  } catch (error) {
    errors.push(serializeError(error));
  }
  return { ...rest, errors, snapshot };
}

module.exports = { pageConfig, saveSnapshots };
