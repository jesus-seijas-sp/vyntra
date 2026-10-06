# Asymmetric matchers

Used in expected values: they match any value that passes their check. The ones with `expect.not.` match the values that do not.

| Matcher | Matches |
| --- | --- |
| `expect.anything()` | anything but `null` and `undefined` |
| `expect.any(Class)` | instances of `Class`, or primitives of that type (`String`, `Number`...) |
| `expect.objectContaining(object)` | objects with these properties |
| `expect.arrayContaining(array)` | arrays with these elements, in any order |
| `expect.stringContaining(string)` | strings containing `string` |
| `expect.stringMatching(regexp)` | strings matching `regexp` |
| `expect.closeTo(n, digits?)` | numbers close to `n` |
