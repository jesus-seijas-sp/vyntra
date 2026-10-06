// What an agent can do on a Playwright page, as tools a model calls: each names its target the way a person would
// (a role and a name, a label, a text), which is also how the page's accessibility tree shows it.
const { setTimeout: sleep } = require('node:timers/promises');
const { redact, taint } = require('vyntra/engine');
const { reveal } = require('./secrets');
const { checkUrl } = require('./guard');
const { routeOf } = require('./route');

const MAX_TREE = 30_000;

// The dialog each page opened during an agent's action and still waits on: { dialog, pending }, pending being the
// action it interrupted, which ends once the dialog is answered.
const dialogs = new WeakMap();
const DIALOG_ACTIONS = new Set(['accept_dialog', 'dismiss_dialog']);

const nullable = (type, description) => ({ anyOf: [{ type }, { type: 'null' }], description });

const TARGET = {
  type: 'object',
  description:
    'The element, as the accessibility tree shows it. Give role and name (preferred), or label, placeholder or ' +
    'text; set the others to null. A line "- text: Write tests" is plain text, with no role: give text. nth picks ' +
    'one of several matches, from 0.',
  properties: {
    role: nullable('string', 'An ARIA role from the tree: button, link, textbox, checkbox, combobox, listitem...'),
    name: nullable('string', 'The accessible name of the element, exactly as the tree shows it'),
    label: nullable('string', 'The text of the label of a form field'),
    placeholder: nullable('string', 'The placeholder of a text field'),
    text: nullable('string', 'Text the element shows, exactly'),
    nth: nullable('integer', 'Which match, from 0, when several elements match'),
    frame: nullable('string', 'The iframe the element is in, as the tree names it (Inside iframe "Coupon": Coupon)'),
  },
  required: ['role', 'name', 'label', 'placeholder', 'text', 'nth', 'frame'],
  additionalProperties: false,
};

const object = (properties) => ({
  type: 'object',
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});

const TOOLS = [
  { name: 'click', description: 'Click an element.', inputSchema: object({ target: TARGET }) },
  {
    name: 'fill',
    description: 'Replace the text of a text field with a value.',
    inputSchema: object({ target: TARGET, value: { type: 'string' } }),
  },
  {
    name: 'press',
    description:
      'Press a key (Enter, Tab, Escape, ArrowDown, Control+A...) on an element, or on the page when target is null.',
    inputSchema: object({ key: { type: 'string' }, target: { anyOf: [TARGET, { type: 'null' }] } }),
  },
  {
    name: 'select_option',
    description: 'Choose an option of a select element, by its label.',
    inputSchema: object({ target: TARGET, option: { type: 'string' } }),
  },
  {
    name: 'set_checked',
    description: 'Check or uncheck a checkbox or a radio button.',
    inputSchema: object({ target: TARGET, checked: { type: 'boolean' } }),
  },
  {
    name: 'drag',
    description: 'Drag an element and drop it on another (a card onto a column).',
    inputSchema: object({ target: TARGET, to: TARGET }),
  },
  {
    name: 'accept_dialog',
    description:
      'Accept the dialog the page opened (OK on a confirm or an alert); a prompt takes text, null for the others.',
    inputSchema: object({ text: nullable('string', 'What to answer a prompt dialog') }),
  },
  {
    name: 'dismiss_dialog',
    description: 'Dismiss the dialog the page opened (Cancel).',
    inputSchema: object({}),
  },
  {
    name: 'goto',
    description: 'Open a URL, or a path of the site.',
    inputSchema: object({ url: { type: 'string' } }),
  },
  {
    name: 'done',
    description: 'The goal is reached: say what shows it on the page.',
    inputSchema: object({ summary: { type: 'string' } }),
  },
  {
    name: 'give_up',
    description:
      'The goal can not be reached: say why, and what stands in the way. product: the app does not do it, or does it ' +
      'wrong. environment: the app or a service it needs is down or erroring (a 5xx page, no connection). ' +
      'credentials: a sign-in was rejected, or there is no account to use. setup: data or a prerequisite the test ' +
      'should have prepared is not there. unsupported: the page needs an interaction these tools can not do.',
    inputSchema: object({
      reason: { type: 'string' },
      category: { type: 'string', enum: ['product', 'environment', 'credentials', 'setup', 'unsupported'] },
    }),
  },
];

// Offered only to a step whose params hold secrets: the model names the secret, the runner types its value.
const TYPE_SECRET = {
  name: 'type_secret',
  description:
    'Type a secret the goal names as <secret:NAME> into an editable field. You never see its value: give its NAME.',
  inputSchema: object({ target: TARGET, secret: { type: 'string', description: 'The NAME of <secret:NAME>' } }),
};

// The tools of a step: the secrets it may type add type_secret.
const toolsFor = (secrets) => (secrets.size > 0 ? [...TOOLS.slice(0, -2), TYPE_SECRET, ...TOOLS.slice(-2)] : TOOLS);

const FINISHING = new Set(['done', 'give_up']);

// The document a target is in: the page, or an iframe of it by its title or name (or #n, the nth iframe from 1).
function documentOf(page, frame) {
  if (!frame) {
    return page;
  }
  const index = /^#(d+)$/.exec(frame)?.[1];
  const element = index
    ? page.locator('iframe').nth(Number(index) - 1)
    : page.locator(`iframe[title=${JSON.stringify(frame)}], iframe[name=${JSON.stringify(frame)}]`).first();
  return element.contentFrame();
}

// The Playwright locator of a target.
function locate(page, target) {
  const { role: given, name, label, placeholder, nth, frame } = target ?? {};
  // "text" is how the tree shows plain text, not an ARIA role: such an element is found by its text.
  const role = given === 'text' ? null : given;
  const text = target?.text ?? (given === 'text' ? name : null);
  const root = documentOf(page, frame);
  let locator;
  if (role) {
    locator = root.getByRole(role, name ? { name, exact: true } : {});
  } else if (label) {
    locator = root.getByLabel(label, { exact: true });
  } else if (placeholder) {
    locator = root.getByPlaceholder(placeholder, { exact: true });
  } else if (text) {
    locator = root.getByText(text, { exact: true });
  } else {
    throw new Error('The target names nothing: give role and name, label, placeholder or text');
  }
  if (Number.isInteger(nth)) {
    return locator.nth(nth);
  }
  return locator;
}

// Types a secret of the step into a field that takes text; the attempt keeps no screenshot or trace afterwards.
async function typeSecret(page, input, { timeout, secrets }) {
  const handle = secrets.get(input.secret);
  if (!handle) {
    throw new Error(`This step has no secret named ${input.secret}`);
  }
  const locator = locate(page, input.target);
  if (!(await locator.isEditable({ timeout }))) {
    throw new Error('The target does not take text: type a secret into an enabled text field');
  }
  taint();
  await locator.fill(reveal(handle), { timeout });
}

// Does one action; throws what went wrong, for the model to try something else.
function run(page, { name, input }, { timeout, secrets = new Map() }) {
  switch (name) {
    case 'type_secret':
      return typeSecret(page, input, { timeout, secrets });
    case 'click':
      return locate(page, input.target).click({ timeout });
    case 'fill':
      return locate(page, input.target).fill(input.value, { timeout });
    case 'press':
      return input.target ? locate(page, input.target).press(input.key, { timeout }) : page.keyboard.press(input.key);
    case 'select_option':
      return locate(page, input.target).selectOption({ label: input.option }, { timeout });
    case 'set_checked':
      return locate(page, input.target).setChecked(input.checked, { timeout });
    case 'drag':
      return locate(page, input.target).dragTo(locate(page, input.to), { timeout });
    case 'goto':
      return page.goto(checkUrl(input.url), { timeout: Math.max(timeout, 15_000) });
    default:
      throw new Error(`There is no ${name} action`);
  }
}

const SETTLE_MS = 150;
const SETTLE_LIMIT_MS = 3_000;

const MAX_FRAMES = 5;

const snapshotOf = (root) =>
  root
    .locator('body')
    .ariaSnapshot({ timeout: 5_000 })
    .catch((error) => `(no accessibility tree: ${error.message.split('\n')[0]})`);

// The page's accessibility tree, and the content of its iframes after it (the page's own tree shows an iframe, not
// what is in it), each under the name a target's frame takes.
async function treeOf(page) {
  const own = await snapshotOf(page);
  const frames = page.locator('iframe');
  const count = Math.min(await frames.count().catch(() => 0), MAX_FRAMES);
  const inside = await Promise.all(
    [...Array(count).keys()].map(async (i) => {
      const element = frames.nth(i);
      const name =
        (await element.getAttribute('title').catch(() => null)) ??
        (await element.getAttribute('name').catch(() => null)) ??
        `#${i + 1}`;
      const content = await snapshotOf(element.contentFrame());
      return `- Inside iframe ${JSON.stringify(name)} (frame: ${JSON.stringify(name)}):\n${content.replace(/^/gm, '  ')}`;
    })
  );
  return [own, ...inside].join('\n');
}

// The page's address without its origin, the same on every machine whichever port the app runs on: `shown`, with
// the query and the hash, for the model; `keyed`, its route (see route.js), for the key of a recording: ids, tokens
// and timestamps in it read as placeholders, as tests often open pages on addresses of their own (?list=<uuid>).
function addressOf(page) {
  try {
    const url = new URL(page.url());
    if (url.protocol.startsWith('http')) {
      return { shown: `${url.pathname}${url.search}${url.hash}`, keyed: routeOf(page.url()) };
    }
  } catch {
    // Not a URL: as it is.
  }
  return { shown: page.url(), keyed: page.url() };
}

// The requests of each page still waiting for their response, counted from the first time the agent looks at it.
const inFlight = new WeakMap();

function pendingRequests(page) {
  if (!inFlight.has(page)) {
    const pending = new Set();
    page.on('request', (request) => pending.add(request));
    page.on('requestfinished', (request) => pending.delete(request));
    page.on('requestfailed', (request) => pending.delete(request));
    inFlight.set(page, pending);
  }
  return inFlight.get(page);
}

// Waits until the page stops changing: no request waiting for its response, and two reads of the accessibility tree
// 150 ms apart that agree (3 seconds at most); returns the tree. After every action, recorded or replayed: an action
// replayed while the page still answers the one before (a todo being saved) would act on a page the recording never
// saw.
async function settle(page) {
  await page.waitForLoadState('domcontentloaded').catch(() => {});
  const pending = pendingRequests(page);
  const deadline = Date.now() + SETTLE_LIMIT_MS;
  let tree = await treeOf(page);
  for (;;) {
    // eslint-disable-next-line no-await-in-loop -- read again until two reads agree
    await sleep(SETTLE_MS);
    // eslint-disable-next-line no-await-in-loop
    const again = await treeOf(page);
    const settled = again === tree && pending.size === 0;
    tree = again;
    if (settled || Date.now() >= deadline) {
      return tree;
    }
  }
}

// What the page shows once it has settled: its address, its title and its accessibility tree, as { text } for the
// model and { key } for the key of a recording, plus { route, tree } for the effect of a step. It is the input of
// every page step: a page caught halfway through an update would make a recorded result miss.
async function pageState(page) {
  const dialog = dialogs.get(page)?.dialog;
  if (dialog) {
    // The page waits for the dialog: nothing else on it can be read or done until it is answered.
    const said = redact(
      `A ${dialog.type()} dialog is open: ${JSON.stringify(dialog.message())}. Answer it with accept_dialog or dismiss_dialog.`
    );
    const address = addressOf(page);
    return {
      text: `Page: ${redact(address.shown)}\n\n${said}`,
      key: `Page: ${redact(address.keyed)}\n\n${said}`,
      route: redact(address.keyed),
      tree: said,
    };
  }
  // Secret values the page shows (typed into a field that is not a password field, echoed back) never leave it.
  let tree = redact(await settle(page));
  if (tree.length > MAX_TREE) {
    tree = `${tree.slice(0, MAX_TREE)}\n… (cut)`;
  }
  const address = addressOf(page);
  const shown = redact(address.shown);
  const keyed = redact(address.keyed);
  const rest = `Title: ${redact(await page.title().catch(() => ''))}\n\n${tree}`;
  return { text: `Page: ${shown}\n${rest}`, key: `Page: ${keyed}\n${rest}`, route: keyed, tree };
}

async function answer(page, { name, input }) {
  const open = dialogs.get(page);
  if (!open) {
    throw new Error('No dialog is open');
  }
  dialogs.delete(page);
  await (name === 'accept_dialog' ? open.dialog.accept(input?.text ?? undefined) : open.dialog.dismiss());
  await open.pending;
  await settle(page);
}

// Does one action and waits for the page to settle after it. A dialog the action opens is kept open for the agent to
// answer (Playwright would dismiss it): the page waits on it, and so does the action, which ends once it is answered.
// The dialogs are listened for only while an agent acts, so those a test answers itself are left to the test.
async function perform(page, action, options) {
  if (DIALOG_ACTIONS.has(action.name)) {
    await answer(page, action);
    return;
  }
  const open = dialogs.get(page);
  if (open) {
    throw new Error(`A ${open.dialog.type()} dialog is open: answer it with accept_dialog or dismiss_dialog first`);
  }
  const opened = Promise.withResolvers();
  const onDialog = (dialog) => opened.resolve(dialog);
  page.on('dialog', onDialog);
  try {
    const running = run(page, action, options);
    const dialog = await Promise.race([running.then(() => null), opened.promise]);
    if (dialog) {
      dialogs.set(page, { dialog, pending: running.catch(() => {}) });
      return;
    }
  } finally {
    page.off('dialog', onDialog);
  }
  await settle(page);
}

module.exports = { TOOLS, FINISHING, toolsFor, perform, pageState, locate };
