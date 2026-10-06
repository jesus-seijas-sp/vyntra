const fs = require('node:fs');
const path = require('node:path');
const { format } = require('../expect/format');
const { readSnapshotFile, writeSnapshotFile } = require('./snapshot-file');
const { writeInlineSnapshots } = require('./inline-snapshots');

// The snapshots of one test file: its .snap file, the inline ones, and what changed in this run.
class SnapshotState {
  // stored: the .snap file as read elsewhere (a browser page has no file system), instead of reading it. style: of
  // a new file; one that exists keeps its own.
  constructor(testPath, { update = false, ci = false, serializers = [], stored, style: newStyle = 'jest' } = {}) {
    this.testPath = testPath;
    this.file = SnapshotState.pathFor(testPath);
    this.update = update;
    this.ci = ci;
    this.serializers = serializers;
    const { data, style, exists } = stored ?? readSnapshotFile(this.file);
    this.data = data;
    this.style = exists ? style : newStyle;
    this.exists = exists;
    this.dirty = false;
    // Keys this run wrote: what is merged into the file when other runs (shards of the file) may have written it.
    this.written = new Set();
    this.checked = new Set();
    this.inlineUpdates = [];
    this.counts = { added: 0, updated: 0, matched: 0, failed: 0 };
  }

  // Line breaks as \n, as Jest and vitest store them: a value with \r\n matches the snapshot on every system.
  serialize(value) {
    return format(value, { escapeString: false, plugins: this.serializers }).replace(/\r\n|\r/g, '\n');
  }

  // Jest names snapshots "describe test 1", vitest "describe > test 1".
  keyFor(titlePath, hint, count) {
    const name = titlePath.join(this.style === 'vitest' ? ' > ' : ' ');
    return `${name}${hint ? `: ${hint}` : ''} ${count}`;
  }

  // Whether a missing snapshot can be written: not on CI unless updating, as Jest.
  canWrite() {
    return this.update || !this.ci;
  }

  // Compares a serialized value with the stored snapshot: { pass, expected, written }.
  match(key, received) {
    this.checked.add(key);
    const expected = this.data[key];
    if (expected === undefined) {
      if (!this.canWrite()) {
        this.counts.failed += 1;
        return { pass: false, expected, missing: true };
      }
      this.data[key] = received;
      this.dirty = true;
      this.written.add(key);
      this.counts.added += 1;
      return { pass: true, expected, written: true };
    }
    if (expected === received) {
      this.counts.matched += 1;
      return { pass: true, expected };
    }
    if (this.update) {
      this.data[key] = received;
      this.dirty = true;
      this.written.add(key);
      this.counts.updated += 1;
      return { pass: true, expected, written: true };
    }
    this.counts.failed += 1;
    return { pass: false, expected };
  }

  // An inline snapshot: expected is what the source has (undefined when the call has none).
  matchInline(expected, received, location) {
    if (expected === received) {
      this.counts.matched += 1;
      return { pass: true, expected };
    }
    if ((expected === undefined && this.canWrite()) || this.update) {
      this.inlineUpdates.push({ ...location, snapshot: received });
      this.counts[expected === undefined ? 'added' : 'updated'] += 1;
      return { pass: true, expected, written: true };
    }
    this.counts.failed += 1;
    return { pass: false, expected, missing: expected === undefined };
  }

  // The snapshots of a test that failed are not obsolete, though it stopped before checking them, as in Jest.
  keepSnapshotsOf(titlePath) {
    const name = titlePath.join(this.style === 'vitest' ? ' > ' : ' ').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const ofTest = new RegExp(`^${name}(?:: [\\s\\S]*)? \\d+$`);
    Object.keys(this.data)
      .filter((key) => ofTest.test(key))
      .forEach((key) => this.checked.add(key));
  }

  // Writes what changed and returns the summary of the file. Snapshots no test checked are obsolete, but only
  // known to be when every test of the file ran (complete); results: the file's tests, whose failed ones keep theirs.
  save(complete, results = []) {
    results.filter((test) => test.status === 'failed').forEach((test) => this.keepSnapshotsOf(test.path));
    const obsolete = complete ? Object.keys(this.data).filter((key) => !this.checked.has(key)) : [];
    if (this.update && obsolete.length > 0) {
      obsolete.forEach((key) => delete this.data[key]);
      this.dirty = true;
    }
    if (this.dirty) {
      // A partial run (a shard, a name filter) adds what it wrote to the file as it is now, which other shards of
      // the file may have changed since it was read.
      if (!complete) {
        const { data: current } = readSnapshotFile(this.file);
        this.written.forEach((key) => {
          current[key] = this.data[key];
        });
        this.data = current;
      }
      if (Object.keys(this.data).length === 0) {
        fs.rmSync(this.file, { force: true });
      } else {
        fs.mkdirSync(path.dirname(this.file), { recursive: true });
        writeSnapshotFile(this.file, this.data, this.style);
      }
    }
    if (this.inlineUpdates.length > 0) {
      writeInlineSnapshots(this.testPath, this.inlineUpdates);
    }
    return { ...this.counts, obsolete: this.update ? 0 : obsolete.length };
  }

  static pathFor(testPath) {
    return path.join(path.dirname(testPath), '__snapshots__', `${path.basename(testPath)}.snap`);
  }

  // What a browser page sends back to be saved in Node, by restore().
  transfer() {
    return {
      data: this.data,
      style: this.style,
      exists: this.exists,
      dirty: this.dirty,
      written: [...this.written],
      checked: [...this.checked],
      inlineUpdates: this.inlineUpdates,
      counts: this.counts,
    };
  }

  static restore(testPath, options, transferred) {
    const { data, style, exists, written, checked, ...rest } = transferred;
    return Object.assign(new SnapshotState(testPath, { ...options, style, stored: { data, style, exists } }), rest, {
      written: new Set(written),
      checked: new Set(checked),
    });
  }
}

module.exports = { SnapshotState };
