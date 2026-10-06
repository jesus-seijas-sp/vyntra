// The agent can not reach the dashboard: the app is down, or the sign-in is rejected.
test('the app is down', async ({ page, agent }) => {
  await page.setContent('<title>502 Bad Gateway</title><h1>502 Bad Gateway</h1>');
  await agent.act('reach the dashboard');
});

test('the sign-in is rejected', async ({ page, agent }) => {
  await page.setContent('<title>Sign in</title><p role="alert">Invalid password</p>');
  await agent.act('reach the dashboard');
});
