// A sign-in page that shows the password it was given (as a careless app might): the agent types it without seeing
// it, and the page's echo of it reaches neither the model nor the recordings.
const { secret } = require(process.env.VYNTRA_AI_SRC);

const HTML = `
  <title>Sign in</title>
  <label>Username <input name="user" /></label>
  <label>Password <input name="password" type="password" /></label>
  <button>Sign in</button>
  <p role="status"></p>
  <script>
    document.querySelector('button').addEventListener('click', () => {
      const user = document.querySelector('[name=user]').value;
      const password = document.querySelector('[name=password]').value;
      document.querySelector('[role=status]').textContent = 'Welcome ' + user + ', your password is ' + password;
    });
  </script>`;

test('signs in with a secret', async ({ page, agent }) => {
  const password = secret('APP_PASSWORD');
  await page.setContent(HTML);
  await agent.act('sign in as {user} with the password {password}', { params: { user: 'ada', password } });
  await expect(page.getByRole('status')).toContainText('Welcome ada');
  if (process.env.FAIL_AFTER) {
    throw new Error(`The page says: ${await page.getByRole('status').textContent()}`);
  }
});
