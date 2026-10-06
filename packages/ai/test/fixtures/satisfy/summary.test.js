const summary = 'Your order of 3 books ships on Monday. The refund of 12 EUR is on its way.';

test('a summary mentions the refund', async () => {
  await expect(summary).toSatisfy('mentions The refund of 12 EUR');
});

test('a summary says nothing of the delay', async () => {
  await expect(summary).not.toSatisfy('mentions a delay');
});

test('a value that is not text', async () => {
  await expect({ status: 'shipped', items: 3 }).toSatisfy(process.env.BREAK_AI ? 'mentions cancelled' : 'mentions shipped');
});
