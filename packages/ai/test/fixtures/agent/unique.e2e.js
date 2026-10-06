// A sign-up with an email address no run repeats: the recording holds <unique:email>, and replays type their own.
const { unique } = require(process.env.VYNTRA_AI_SRC);

const HTML = `
  <title>Sign up</title>
  <label>Email <input name="email" /></label>
  <button>Sign up</button>
  <p role="status"></p>
  <script>
    document.querySelector('button').addEventListener('click', () => {
      document.querySelector('[role=status]').textContent = 'Welcome ' + document.querySelector('input').value;
    });
  </script>`;

test('signs up with a fresh email', async ({ page, agent }) => {
  const email = `ada+${Date.now()}-${process.pid}@example.test`;
  await page.setContent(HTML);
  await agent.act('sign up with the email {email}', { params: { email: unique(email) } });
  await expect(page.getByRole('status')).toHaveText(`Welcome ${email}`);
  await agent.assert('mentions Welcome');
});
