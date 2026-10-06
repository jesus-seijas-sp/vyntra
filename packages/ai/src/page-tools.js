// What an agent can do on a Playwright page, as tools a model calls: each names its target the way a person would
// (a role and a name, a label, a text), which is also how the page's accessibility tree shows it.
const { setTimeout: sleep } = require('node:timers/promises');
const { redact, taint } = require('vyntra/engine');
const { reveal } = require('./secrets');
const { checkUrl } = require('./guard');
const { routeOf } = require('./route');

const MAX_TREE = 30_000;

const nullable = (type, description) => ({ anyOf: [{ type }, { type: 'null' }], description });

const TARGET = {
  type: 'object',
  description:
    'The element, as the accessibility tree shows it. Give role and name (preferred), or label, placeholder or ' +
    'text; set the others to null. nth picks one of several matches, from 0.',
  properties: {
    role: nullable('string', 'An ARIA role from the tree: button, link, textbox, checkbox, combobox, listitem...'),
    name: nullable('string', 'The accessible name of the element, exactly as the tree shows it'),
    label: nullable('string', 'The text of the label of a form field'),
    placeholder: nullable('string', 'The placeholder of a text field'),
    text: nullable('string', 'Text the element shows, exactly'),
    nth: nullable('integer', 'Which match, from 0, when several elements match'),
  },
  required: ['role', 'name', 'label', 'placeholder', 'text', 'nth'],
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

// The Playwright locator of a target.
function locate(page, target) {
  const { role, name, label, placeholder, text, nth } = target ?? {};
  let locator;
  if (role) {
    locator = page.getByRole(role, name ? { name, exact: true } : {});
  } else if (label) {
    locator = page.getByLabel(label, { exact: true });
  } else if (placeholder) {
    locator = page.getByPlaceholder(placeholder, { exact: true });
  } else if (text) {
    locator = page.getByText(text, { exact: true });
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
    case 'goto':
      return page.goto(checkUrl(input.url), { timeout: Math.max(timeout, 15_000) });
    default:
      throw new Error(`There is no ${name} action`);
  }
}

const SETTLE_MS = 150;
const SETTLE_LIMIT_MS = 3_000;

const treeOf = (page) =>
  page
    .locator('body')
    .ariaSnapshot({ timeout: 5_000 })
    .catch((error) => `(no accessibility tree: ${error.message.split('\n')[0]})`);

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

// Does one action and waits for the page to settle after it.
async function perform(page, action, options) {
  await run(page, action, options);
  await settle(page);
}

module.exports = { TOOLS, FINISHING, toolsFor, perform, pageState, locate };
