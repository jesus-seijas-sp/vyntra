test('reaches the server it started', async ({ server }) => {
  const response = await fetch(new URL('/users', server.url));
  expect(await response.json()).toEqual([{ id: 1, name: 'Ann' }]);
  expect(server.reused).toBe(Boolean(process.env.APP_REUSE));
});

test('fails with the server output on its page', async ({ server }) => {
  const response = await fetch(new URL('/missing', server.url));
  expect(response.status).toBe(process.env.EXPECT_MISSING ? 404 : 200);
});
