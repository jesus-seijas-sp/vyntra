// An it() / test().
class TestCase {
  constructor(name, fn, parent, mode, options = {}, flags = {}) {
    this.type = 'test';
    this.name = name;
    this.fn = fn;
    this.parent = parent;
    this.mode = mode;
    this.timeout = options.timeout;
    this.retry = options.retry;
    this.repeats = options.repeats ?? 0;
    this.fails = Boolean(flags.fails || options.fails);
    this.concurrent = flags.sequential ? false : Boolean(flags.concurrent || options.concurrent || parent.concurrent);
    this.fullName = parent.fullName ? `${parent.fullName} ${name}` : name;
    this.fixtures = flags.fixtures;
    // Its tags and those of the describe blocks around it, for --tag and --exclude-tag.
    this.tags = [...new Set([...(parent.tags ?? []), ...[options.tags ?? []].flat()])];
    // Set when a beforeAll of its suites failed.
    this.failError = null;
  }

  // State of one run of the test, set before every attempt (not at collection: most tests are never retried and
  // skipped ones never run).
  reset() {
    this.assertions = 0;
    this.expectedAssertions = undefined;
    this.hasAssertions = false;
    this.softErrors = [];
    this.pendingAssertions = [];
    this.onFinished = [];
    this.onFailed = [];
    this.abort = new AbortController();
    // Snapshot name -> calls so far, for the numbers of the snapshot keys.
    this.snapshotCounts = new Map();
    // The HTTP requests of the api fixture, and their responses: shown when the test fails.
    this.exchanges = [];
    // Files and text fixtures attach for the failure page (a screenshot, a trace), and whether the attempt failed,
    // known before the fixtures tear down so they can save what they hold.
    this.attachments = [];
    // Checks of the app that passed (a web-first assertion, agent.assert), counted for engines: an AI step's recording
    // is kept only when a later check confirmed what it did.
    this.verifications = 0;
    // Whether a secret was typed into the page: from then on no screenshot or trace of the attempt is kept, as the app
    // may show the value anywhere.
    this.tainted = false;
    this.failing = false;
    this.attempt = (this.attempt ?? -1) + 1;
    // A benchmark's statistics, when the test is one.
    this.benchResult = undefined;
  }

  // Names from the outermost describe to the test.
  get titlePath() {
    const names = [this.name];
    for (let suite = this.parent; suite?.parent; suite = suite.parent) {
      names.unshift(suite.name);
    }
    return names;
  }
}

module.exports = { TestCase };
