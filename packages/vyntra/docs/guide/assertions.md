# Assertions

`expect(value)` has every matcher of Jest and the ones Vitest adds. `.not` negates them; `.resolves` and `.rejects` apply them to what a promise settles to.

```js
expect(total).toBe(20);
expect(user).toEqual({ id: 1, name: 'Ann' });        // deep equality
expect(user).toStrictEqual(new User(1, 'Ann'));      // also checks classes and undefined properties
expect(response).toMatchObject({ status: 200 });     // a subset
expect(list).toContain('apple');
expect(order).toHaveProperty('lines[0].price', 10);
expect(() => parse('{')).toThrow(/Unexpected end/);
await expect(save(user)).resolves.toBeUndefined();
await expect(load(-1)).rejects.toThrow('not found');
```

Asymmetric matchers stand for any value that passes a check, inside the expected value:

```js
expect(created).toEqual({
  id: expect.any(String),
  createdAt: expect.any(Date),
  tags: expect.arrayContaining(['new']),
  email: expect.stringMatching(/@example\.com$/),
});
```

## More tools

- `expect.soft(value)` records the failure and lets the test go on, to see every failure at once.
- `expect.poll(() => value).toBe(x)` retries until the assertion passes or a timeout ends.
- `expect.assertions(n)` and `expect.hasAssertions()` check that the assertions really ran (in callbacks, for example).
- `expect.extend({ toBeWithin(received, a, b) { ... } })` adds matchers, usable as asymmetric matchers too.

Every matcher is listed in the [API reference](../api/matchers.md).
