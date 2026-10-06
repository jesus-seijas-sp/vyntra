const fs = require('node:fs');
const path = require('node:path');
const { EnvironmentError } = require('vyntra/engine');

// What a run spent on models, over all its workers (threads and processes): one line per call in a file of the
// run's output directory, tagged with the run, and one per step saying how it was answered (for the run's summary).
// Workers check it before a call, so a run that would overspend stops (exit code 3) instead of running up a bill;
// calls made at the same moment by several workers may pass it by a few.
class Budget {
  constructor({ calls, tokens }, file) {
    this.limits = { calls, tokens };
    this.file = file;
    this.run = process.env.VYNTRA_RUN_ID ?? `${process.pid}`;
  }

  // The lines of a usage file for one run.
  static entries(file, run) {
    let text = '';
    try {
      text = fs.readFileSync(file, 'utf8');
    } catch {
      return [];
    }
    return text
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter((entry) => entry?.run === run);
  }

  spent() {
    return Budget.entries(this.file, this.run)
      .filter((entry) => entry.tokens !== undefined)
      .reduce((sum, entry) => ({ calls: sum.calls + 1, tokens: sum.tokens + entry.tokens }), { calls: 0, tokens: 0 });
  }

  check() {
    const spent = this.spent();
    if (spent.calls >= this.limits.calls || spent.tokens >= this.limits.tokens) {
      throw new EnvironmentError(
        `The AI budget of the run is spent: ${spent.calls} model calls and ${spent.tokens} tokens ` +
          `(use.ai.budget: { calls: ${this.limits.calls}, tokens: ${this.limits.tokens} })`
      );
    }
  }

  // A model call: its tokens, and the model that answered.
  add({ inputTokens, outputTokens }, model) {
    this.write({ tokens: inputTokens + outputTokens, input: inputTokens, output: outputTokens, model });
  }

  // How a step was answered: replayed, handed-off or missed.
  note(step) {
    this.write({ step });
  }

  write(entry) {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.appendFileSync(this.file, `${JSON.stringify({ run: this.run, ...entry })}\n`);
  }
}

module.exports = { Budget };
