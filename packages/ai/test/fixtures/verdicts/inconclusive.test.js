test('a claim the value does not settle', async () => {
  await expect(expect('Order 42 is on its way.').toSatisfy('nobody can tell when it arrives')).rejects.toThrow(
    'is inconclusive'
  );
});
