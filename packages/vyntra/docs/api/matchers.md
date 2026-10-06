# Matchers

`expect(value, message?)` returns the matchers. `message` is shown before the failure. `.not` negates a matcher; `.resolves` and `.rejects` apply it to the value a promise (or a function returning one) settles to, and return a promise.

| Matcher | Passes when the value |
| --- | --- |
| `toBe(expected)` | is `expected` (`Object.is`) |
| `toEqual(expected)` | is deeply equal, ignoring `undefined` properties and classes |
| `toStrictEqual(expected)` | is deeply equal, including `undefined` properties, array holes and classes |
| `toMatchObject(object)` | has every property of `object`, recursively |
| `toBeDefined()`, `toBeUndefined()` | is not / is `undefined` |
| `toBeNull()`, `toBeNaN()` | is `null` / `NaN` |
| `toBeTruthy()`, `toBeFalsy()` | is truthy / falsy |
| `toBeGreaterThan(n)`, `toBeGreaterThanOrEqual(n)` | is `>` / `>=` `n` (numbers or bigints) |
| `toBeLessThan(n)`, `toBeLessThanOrEqual(n)` | is `<` / `<=` `n` |
| `toBeCloseTo(n, digits = 2)` | differs from `n` by less than `10-digits / 2` |
| `toBeInstanceOf(Class)` | is an instance of `Class` |
| `toBeTypeOf(type)` | has that `typeof` |
| `toBeOneOf(values)` | equals one of `values` |
| `toSatisfy(predicate)` | makes `predicate` return true |
| `toContain(item)` | (array, string or iterable) contains `item` |
| `toContainEqual(item)` | contains an element equal to `item` |
| `toHaveLength(n)` | has `length` `n` |
| `toHaveProperty(path, value?)` | has the property at `path` (`'a.b[0].c'` or an array), with that value |
| `toMatch(pattern)` | (a string) contains `pattern`, or matches it when it is a regular expression |
| `toThrow(expected?)` / `toThrowError` | (a function) throws: an error whose message contains a string, matches a regular expression, of a class, or with the message of an error. With `.rejects`, the rejection |
