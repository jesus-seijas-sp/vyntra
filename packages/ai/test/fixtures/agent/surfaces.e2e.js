// A native dialog, a form in an iframe and drag and drop: each done by the agent, then replayed.
const status = '<p role="status"></p><script>function done(m) { document.querySelector("[role=status]").textContent = m; }</script>';

test('accepts a native confirm dialog', async ({ page, agent }) => {
  await page.setContent(`<title>Draft</title><button>Delete draft</button>${status}
    <script>document.querySelector('button').onclick = () => done(confirm('Delete the draft?') ? 'Draft deleted' : 'Kept the draft');</script>`);
  await agent.act('delete the draft');
  await expect(page.getByRole('status')).toHaveText('Draft deleted');
});

test('fills a form inside an iframe', async ({ page, agent }) => {
  await page.setContent(`<title>Checkout</title>${status}
    <iframe title="Coupon" srcdoc="<label>Coupon <input></label><button>Apply</button>
      <script>document.querySelector('button').onclick = () => parent.postMessage(document.querySelector('input').value, '*');</script>"></iframe>
    <script>window.onmessage = (event) => done('Coupon ' + event.data + ' applied');</script>`);
  await agent.act('apply the coupon SAVE10');
  await expect(page.getByRole('status')).toHaveText('Coupon SAVE10 applied');
});

test('drags a card to another column', async ({ page, agent }) => {
  await page.setContent(`<title>Board</title>${status}
    <section aria-label="Backlog"><div draggable="true" id="card">Write tests</div></section>
    <section aria-label="Done"><h2>Done</h2></section>
    <script>
      const card = document.querySelector('#card');
      const target = document.querySelector('[aria-label=Done]');
      card.ondragstart = (event) => event.dataTransfer.setData('text/plain', card.textContent);
      target.ondragover = (event) => event.preventDefault();
      target.ondrop = (event) => { event.preventDefault(); target.append(card); done('Moved to Done'); };
    </script>`);
  await agent.act('move the card Write tests to Done');
  await expect(page.getByRole('status')).toHaveText('Moved to Done');
});
