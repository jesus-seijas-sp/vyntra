// What only pixels show: a button drawn on a canvas, a chart; and no screenshot once a secret was typed.
const { secret, fillSecret } = require(process.env.VYNTRA_AI_SRC);

const CANVAS = `<title>Canvas</title>
  <canvas width="240" height="80" style="position: absolute; left: 0; top: 0"></canvas>
  <p role="status" style="margin-top: 100px"></p>
  <script>
    const canvas = document.querySelector('canvas');
    const context = canvas.getContext('2d');
    context.fillStyle = '#2b6';
    context.fillRect(40, 20, 120, 40);
    canvas.onclick = (event) => {
      if (event.offsetX >= 40 && event.offsetX <= 160 && event.offsetY >= 20 && event.offsetY <= 60) {
        document.querySelector('[role=status]').textContent = 'Started';
      }
    };
  </script>`;

test('presses a button only the screenshot shows', async ({ page, agent }) => {
  await page.setContent(CANVAS);
  await agent.act('press the Start button drawn on the canvas');
  await expect(page.getByRole('status')).toHaveText('Started');
});

test('judges a chart by its screenshot', async ({ page, agent }) => {
  await page.setContent(CANVAS);
  await agent.assert('a green rectangle is drawn', { vision: 'only' });
});

test('takes no screenshot once a secret was typed', async ({ page, agent }) => {
  await page.setContent('<title>Sign in</title><label>Password <input type="password"></label>');
  await fillSecret(page.getByLabel('Password'), secret('APP_PASSWORD'));
  await expect(agent.assert('the form is empty', { vision: 'only' })).rejects.toThrow('No screenshot to judge');
});
