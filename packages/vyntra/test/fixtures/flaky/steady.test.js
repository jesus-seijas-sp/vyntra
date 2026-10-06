let attempts = 0;

it('passes on the second attempt', { retry: 1 }, () => {
  attempts += 1;
  expect(attempts).toBe(2);
});
