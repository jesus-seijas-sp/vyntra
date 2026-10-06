// The scenarios of the agent benchmark: each page isolates one surface that is hard to automate, with a task in
// words for the agent, the status message that proves it was done, and how a deterministic test solves it (the floor
// the agent is measured against: a scenario it fails, the tools can still do). Every page reports success in its
// role="status" paragraph.

const scenarios = [
  {
    slug: 'plain-form',
    name: 'A plain form',
    surface: 'Labelled fields and a button: the control, which every agent should pass',
    task: 'sign up for the newsletter with the email ada@example.test',
    success: 'Subscribed ada@example.test',
    html: `<label>Email <input name="email" /></label>
      <button>Subscribe</button>
      <script>
        document.querySelector('button').onclick = () => done('Subscribed ' + document.querySelector('input').value);
      </script>`,
    solve: async (page) => {
      await page.getByLabel('Email').fill('ada@example.test');
      await page.getByRole('button', { name: 'Subscribe' }).click();
    },
  },
  {
    slug: 'shadow-dom',
    name: 'Shadow DOM',
    surface: 'A button inside the shadow root of a custom element',
    task: 'confirm the order',
    success: 'Order confirmed',
    html: `<order-card></order-card>
      <script>
        customElements.define('order-card', class extends HTMLElement {
          connectedCallback() {
            const root = this.attachShadow({ mode: 'open' });
            root.innerHTML = '<h2>Your order</h2><p>2 books, 31 EUR</p><button>Confirm order</button>';
            root.querySelector('button').onclick = () => done('Order confirmed');
          }
        });
      </script>`,
    solve: (page) => page.getByRole('button', { name: 'Confirm order' }).click(),
  },
  {
    slug: 'iframe',
    name: 'A form in an iframe',
    surface: 'The fields live in another document, inside an iframe',
    task: 'apply the coupon SAVE10',
    success: 'Coupon SAVE10 applied',
    html: `<iframe title="Coupon" style="height: 120px" srcdoc="
        <label>Coupon <input name=coupon></label>
        <button>Apply</button>
        <script>
          document.querySelector('button').onclick = () =>
            parent.postMessage(document.querySelector('input').value, '*');
        </script>"></iframe>
      <script>window.addEventListener('message', (event) => done('Coupon ' + event.data + ' applied'));</script>`,
    solve: async (page) => {
      const frame = page.frameLocator('iframe');
      await frame.getByLabel('Coupon').fill('SAVE10');
      await frame.getByRole('button', { name: 'Apply' }).click();
    },
  },
  {
    slug: 'native-dialog',
    name: 'A native confirm dialog',
    surface: 'window.confirm() must be accepted; a dismissed dialog keeps the draft',
    task: 'delete the draft',
    success: 'Draft deleted',
    html: `<p>Draft: "Quarterly update"</p>
      <button>Delete draft</button>
      <script>
        document.querySelector('button').onclick = () =>
          done(confirm('Delete the draft?') ? 'Draft deleted' : 'Kept the draft');
      </script>`,
    solve: async (page) => {
      page.once('dialog', (dialog) => dialog.accept());
      await page.getByRole('button', { name: 'Delete draft' }).click();
    },
  },
  {
    slug: 'remounting-dom',
    name: 'A list that remounts',
    surface: 'The list is rebuilt every 400 ms: elements found a moment ago are gone',
    task: 'archive the Q3 report',
    success: 'Archived Q3 report',
    html: `<ul></ul>
      <script>
        const reports = ['Q1 report', 'Q2 report', 'Q3 report'];
        const render = () => {
          const list = document.querySelector('ul');
          list.innerHTML = reports.map((name) => '<li>' + name + ' <button>Archive ' + name + '</button></li>').join('');
          list.querySelectorAll('button').forEach((button, i) => {
            button.onclick = () => done('Archived ' + reports[i]);
          });
        };
        render();
        setInterval(render, 400);
      </script>`,
    solve: (page) => page.getByRole('button', { name: 'Archive Q3 report' }).click(),
  },
  {
    slug: 'delayed-enable',
    name: 'A button enabled late',
    surface: 'The button is disabled for 1.5 s while the payment loads',
    task: 'pay the invoice',
    success: 'Paid',
    html: `<p>Invoice #42: 120 EUR</p>
      <button disabled>Pay</button>
      <script>
        const button = document.querySelector('button');
        setTimeout(() => { button.disabled = false; }, 1500);
        button.onclick = () => done('Paid');
      </script>`,
    solve: (page) => page.getByRole('button', { name: 'Pay' }).click(),
  },
  {
    slug: 'custom-select',
    name: 'A custom select',
    surface: 'A combobox made of divs, with ARIA roles, not a native select',
    task: 'choose Express shipping',
    success: 'Shipping: Express',
    html: `<div role="combobox" aria-label="Shipping" aria-expanded="false" aria-controls="options" tabindex="0">Standard</div>
      <div role="listbox" id="options" hidden>
        <div role="option">Standard</div>
        <div role="option">Express</div>
      </div>
      <script>
        const box = document.querySelector('[role=combobox]');
        const list = document.querySelector('[role=listbox]');
        box.onclick = () => { list.hidden = false; box.setAttribute('aria-expanded', 'true'); };
        list.querySelectorAll('[role=option]').forEach((option) => {
          option.onclick = () => {
            box.textContent = option.textContent;
            list.hidden = true;
            box.setAttribute('aria-expanded', 'false');
            done('Shipping: ' + option.textContent);
          };
        });
      </script>`,
    solve: async (page) => {
      await page.getByRole('combobox', { name: 'Shipping' }).click();
      await page.getByRole('option', { name: 'Express' }).click();
    },
  },
  {
    slug: 'hover-menu',
    name: 'A menu shown on hover',
    surface: 'The menu items exist only while the pointer is over the menu',
    task: 'sign out from the account menu',
    success: 'Signed out',
    html: `<nav><div id="account" tabindex="0">Account</div><div id="menu"></div></nav>
      <script>
        const account = document.querySelector('#account');
        const menu = document.querySelector('#menu');
        account.onmouseenter = () => {
          menu.innerHTML = '<button>Sign out</button>';
          menu.querySelector('button').onclick = () => done('Signed out');
        };
        document.querySelector('nav').onmouseleave = () => { menu.innerHTML = ''; };
      </script>`,
    solve: async (page) => {
      await page.getByText('Account').hover();
      await page.getByRole('button', { name: 'Sign out' }).click();
    },
  },
  {
    slug: 'drag-and-drop',
    name: 'Drag and drop',
    surface: 'A card moves between columns only by dragging it',
    task: 'move the card "Write tests" to the Done column',
    success: 'Moved Write tests to Done',
    html: `<section aria-label="Backlog"><h2>Backlog</h2><div draggable="true" class="card">Write tests</div></section>
      <section aria-label="Done"><h2>Done</h2></section>
      <script>
        const card = document.querySelector('.card');
        card.ondragstart = (event) => event.dataTransfer.setData('text/plain', card.textContent);
        const target = document.querySelector('[aria-label=Done]');
        target.ondragover = (event) => event.preventDefault();
        target.ondrop = (event) => {
          event.preventDefault();
          target.append(card);
          done('Moved ' + event.dataTransfer.getData('text/plain') + ' to Done');
        };
      </script>`,
    solve: (page) => page.getByText('Write tests').dragTo(page.getByRole('region', { name: 'Done' })),
  },
  {
    slug: 'canvas-button',
    name: 'A canvas-only control',
    surface: 'The button is drawn on a canvas: the accessibility tree has nothing to name',
    task: 'press the Start button drawn on the canvas',
    success: 'Started',
    html: `<canvas width="240" height="80"></canvas>
      <script>
        const canvas = document.querySelector('canvas');
        const context = canvas.getContext('2d');
        context.fillStyle = '#2b6';
        context.fillRect(40, 20, 120, 40);
        context.fillStyle = '#fff';
        context.font = '20px sans-serif';
        context.fillText('Start', 75, 47);
        canvas.onclick = (event) => {
          const { left, top } = canvas.getBoundingClientRect();
          const [x, y] = [event.clientX - left, event.clientY - top];
          if (x >= 40 && x <= 160 && y >= 20 && y <= 60) {
            done('Started');
          }
        };
      </script>`,
    solve: (page) => page.locator('canvas').click({ position: { x: 100, y: 40 } }),
  },
  {
    slug: 'infinite-scroll',
    name: 'Infinite scroll',
    surface: 'The item is not in the page until the list is scrolled to its end',
    task: 'open item 35',
    success: 'Opened item 35',
    html: `<ul style="height: 200px; overflow: auto"></ul>
      <script>
        const list = document.querySelector('ul');
        let shown = 0;
        const more = () => {
          for (let i = 0; i < 20; i += 1) {
            shown += 1;
            const item = document.createElement('li');
            const n = shown;
            item.innerHTML = 'Item ' + n + ' <button>Open item ' + n + '</button>';
            item.querySelector('button').onclick = () => done('Opened item ' + n);
            list.append(item);
          }
        };
        more();
        list.onscroll = () => {
          if (shown < 60 && list.scrollTop + list.clientHeight >= list.scrollHeight - 5) {
            more();
          }
        };
      </script>`,
    solve: async (page) => {
      const button = page.getByRole('button', { name: 'Open item 35', exact: true });
      // Scrolled to the end until the item is loaded.
      const scroll = async () => {
        if ((await button.count()) === 0) {
          await page.locator('ul').evaluate((list) => list.scrollTo(0, list.scrollHeight));
          await scroll();
        }
      };
      await scroll();
      await button.click();
    },
  },
];

module.exports = { scenarios };
