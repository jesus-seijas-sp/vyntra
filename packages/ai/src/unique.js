// Values that change from run to run (a timestamped email, a fresh company name): the model sees and types them as
// they are, while the replay cache sees <unique:name>, so the recordings of the steps that use them still match the
// next run, and a replay types that run's value.

class Unique {
  #value;

  constructor(value) {
    this.#value = String(value);
  }

  get value() {
    return this.#value;
  }

  toString() {
    return this.#value;
  }

  toJSON() {
    return this.#value;
  }
}

// unique(`ada+${Date.now()}@example.test`), as a param of an act: { params: { email: unique(...) } }.
const unique = (value) => new Unique(value);
const isUnique = (value) => value instanceof Unique;

module.exports = { unique, isUnique };
