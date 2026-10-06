# HTTP matchers

| Matcher | Passes when |
| --- | --- |
| `toHaveStatus(status)` | The response has that status (`201`), or one of that class (`'2xx'`); a failure shows the request and the start of the body |
| `toHaveHeader(name, value?)` | The response (or a `Headers`, or an object) has the header, equal to `value`, matching it if a `RegExp`, or to an asymmetric matcher |
| `toMatchSchema(schema)` | The value (a response: its body) matches the JSON Schema: types, `properties`, `required`, `additionalProperties`, `items`, `enum`, `const`, lengths, ranges, `pattern`, formats, `allOf`/`anyOf`/`oneOf`/`not`, local `$ref`; a failure lists every problem with its path |
