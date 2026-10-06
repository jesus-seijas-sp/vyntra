let attempts = 0;

it('passes on the second attempt', { retry: 1 }, () => {
  attempts += 1;
  expect(attempts).toBe(2);
});

it('passes', () => {
  expect(1).toBe(1);
});

it('never passes', { retry: 2 }, () => {
  expect(1).toBe(2);
});
