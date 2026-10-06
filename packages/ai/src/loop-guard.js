const crypto = require('node:crypto');

const NUDGE_AFTER = 3;
const VERDICT_AFTER = 5;
const LAST_TURNS = 2;

// Keeps an act step from going round in circles: an action done before on the very same page is refused (it changed
// nothing then, it will change nothing now); after 3 failed actions in a row the model is told to change approach,
// after 5 it is asked for a verdict and offered nothing else; as the step limit nears, it is told how many turns are
// left, and the last one offers only done and give_up.
class LoopGuard {
  constructor(maxSteps) {
    this.maxSteps = maxSteps;
    this.failures = 0;
    this.seen = new Set();
  }

  static signature({ name, input }, pageKey) {
    return crypto
      .createHash('sha256')
      .update(JSON.stringify([name, input, pageKey]))
      .digest('hex');
  }

  // Whether the action was already done on this same page.
  repeated(call, pageKey) {
    return this.seen.has(LoopGuard.signature(call, pageKey));
  }

  done(call, pageKey) {
    this.seen.add(LoopGuard.signature(call, pageKey));
    this.failures = 0;
  }

  failed() {
    this.failures += 1;
  }

  // Before turn `turn` (from 0): whether it may only conclude, and what the model is told.
  advice(turn) {
    const left = this.maxSteps - turn;
    if (this.failures >= VERDICT_AFTER) {
      return {
        concludeOnly: true,
        text:
          `${this.failures} actions in a row failed. Stop trying: call done if the page shows the goal is reached, ` +
          'otherwise give_up and say what stands in the way.',
      };
    }
    if (left <= 1) {
      return {
        concludeOnly: true,
        text: 'This is the last turn of the step: call done if the page shows the goal is reached, otherwise give_up.',
      };
    }
    const notes = [];
    if (this.failures >= NUDGE_AFTER) {
      notes.push(
        `${this.failures} actions in a row failed. Change your approach: read the page again, and name elements ` +
          'exactly as it shows them.'
      );
    }
    if (left <= LAST_TURNS + 1) {
      notes.push(`${left} turns are left for this step: finish the goal, or call done or give_up.`);
    }
    return { concludeOnly: false, text: notes.length > 0 ? notes.join(' ') : null };
  }
}

module.exports = { LoopGuard };
