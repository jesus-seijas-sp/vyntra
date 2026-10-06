// expectTypeOf and assertType, as vitest has them: checks for the type checker (vyntra --typecheck runs it on
// *.test-d.ts files). At run time they do nothing, whatever is called on them, as in vitest.

// Anything read from it, or done with it, is itself.
const chain = new Proxy(function chained() {}, {
  get: (target, key) => (key === 'then' ? undefined : chain),
  apply: () => chain,
});

const expectTypeOf = () => chain;
const assertType = () => {};

module.exports = { expectTypeOf, assertType };
