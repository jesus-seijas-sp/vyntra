const fs = require('node:fs');
const path = require('node:path');
const { slugOf } = require('./run/test-key');

const VERSION = 1;

// Results of slow or costly steps (a model's verdict, the actions an agent took), kept until the input they depended
// on changes: an entry's key is a hash of that input. A cache is one test's file in a directory committed to the
// repository, its entries sorted, so a diff shows a reviewer what changed and merges stay small.
class ReplayCache {
  constructor(file) {
    this.file = file;
    this.entries = null;
  }

  // The cache of a test: <dir>/<test file from the root>/<test>.json.
  static forTest(dir, rootDir, testFile, titlePath) {
    const relative = path.relative(rootDir, testFile).split(path.sep).join('/');
    return new ReplayCache(path.join(dir, relative, `${slugOf('', titlePath)}.json`));
  }

  load() {
    if (this.entries === null) {
      try {
        const data = JSON.parse(fs.readFileSync(this.file, 'utf8'));
        this.entries = data.version === VERSION ? data.entries : {};
      } catch (error) {
        if (error.code !== 'ENOENT' && !(error instanceof SyntaxError)) {
          throw error;
        }
        this.entries = {};
      }
    }
    return this.entries;
  }

  get(key) {
    return this.load()[key];
  }

  // The entries as the file holds them now: another step of the test may have written it since this one read it.
  reload() {
    this.entries = null;
    return this.load();
  }

  // Stores an entry, dropping those `replaces(entry)` says it stands for (the same claim about an older input).
  set(key, entry, replaces = () => false) {
    const entries = Object.entries(this.reload()).filter(([oldKey, old]) => oldKey !== key && !replaces(old));
    this.entries = Object.fromEntries([...entries, [key, entry]].sort(([a], [b]) => (a < b ? -1 : Number(a > b))));
    this.save();
  }

  // Drops an entry (a recording a failed test can no longer vouch for); the file goes when it has none left.
  delete(key) {
    const entries = this.reload();
    if (!Object.hasOwn(entries, key)) {
      return;
    }
    delete entries[key];
    if (Object.keys(entries).length === 0) {
      fs.rmSync(this.file, { force: true });
      return;
    }
    this.save();
  }

  // Written whole and renamed into place: a reader never sees half a file.
  save() {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const temporary = `${this.file}.${process.pid}-${Date.now()}.tmp`;
    fs.writeFileSync(temporary, `${JSON.stringify({ version: VERSION, entries: this.entries }, null, 2)}\n`);
    fs.renameSync(temporary, this.file);
  }
}

module.exports = { ReplayCache };
