const { inspect } = require('node:util');
const { redact } = require('vyntra/engine');
const { AiSession } = require('./session');
const { judge } = require('./judge');
const { InconclusiveError } = require('./inconclusive-error');

// A value as the model reads it: text as it is, anything else as it would print.
// Secret values in it are hidden.
const textOf = (value) =>
  redact(typeof value === 'string' ? value : inspect(value, { depth: 8, breakLength: 100, maxStringLength: 20_000 }));

function clipped(text) {
  return text.length > 2_000 ? `${text.slice(0, 2_000)}…` : text;
}

const matchers = {
  // expect(summary).toSatisfy('mentions the refund amount'): a model judges the claim about the value. The verdict is
  // recorded and reused while the value stays the same; claims should be ones a person could check.
  async toSatisfy(received, claim) {
    if (typeof claim !== 'string' || claim.trim() === '') {
      throw new TypeError('toSatisfy takes a claim about the value, in words');
    }
    const { verdict, reasoning } = await judge(new AiSession(), { kind: 'toSatisfy', claim, input: textOf(received) });
    const hint = `expect(received).${this.isNot ? 'not.' : ''}toSatisfy(claim)`;
    const shown = `\n\nReceived: ${clipped(textOf(received))}`;
    // Neither holds nor fails: the assertion fails either way, .not included, as the value does not settle it.
    if (verdict === 'inconclusive') {
      throw new InconclusiveError(
        `${hint} is inconclusive\n\nClaim: ${claim}\nThe value does not settle it: ${reasoning}${shown}`
      );
    }
    const said = this.isNot ? 'It holds' : 'It does not hold';
    return { pass: verdict === 'holds', message: () => `${hint}\n\nClaim: ${claim}\n${said}: ${reasoning}${shown}` };
  },
};

module.exports = { matchers, textOf };
