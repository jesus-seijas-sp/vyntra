// A judgment the evidence could not settle: the page or the value does not show what the claim is about (another
// screen, data still loading, a value not there). The test fails, saying so, rather than passing or failing on a
// guess.
class InconclusiveError extends Error {
  constructor(message) {
    super(message);
    this.name = 'InconclusiveError';
    this.code = 'ASSERTION_INCONCLUSIVE';
  }
}

module.exports = { InconclusiveError };
