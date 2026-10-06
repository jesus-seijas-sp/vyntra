const { setTimeout: sleep } = require('node:timers/promises');
const { parseLocator, buildLocator } = require('./locator');

// A live session's page, as a coding agent sees and drives it: the page once it settles, elements found the way a
// test finds them (a role and a name, a label, a text, a test id, or a Playwright locator chain), and the test code
// that finds them.

const MAX_TREE = 30_000;
const SETTLE_MS = 150;
const SETTLE_LIMIT_MS = 3_000;
const ACTION_TIMEOUT = 10_000;

const treeOf = (page) =>
  page
    .locator('body')
    .ariaSnapshot({ timeout: 5_000 })
    .catch((error) => `(no accessibility tree: ${error.message.split('\n')[0]})`);

// The page once two reads of its accessibility tree 150 ms apart agree (3 s at most): its address, title and tree.
async function observe(page) {
  await page.waitForLoadState('domcontentloaded').catch(() => {});
  const deadline = Date.now() + SETTLE_LIMIT_MS;
  let tree = await treeOf(page);
  for (;;) {
    // eslint-disable-next-line no-await-in-loop -- read again until two reads agree
    await sleep(SETTLE_MS);
    // eslint-disable-next-line no-await-in-loop
    const again = await treeOf(page);
    const settled = again === tree;
    tree = again;
    if (settled || Date.now() >= deadline) {
      break;
    }
  }
  if (tree.length > MAX_TREE) {
    tree = `${tree.slice(0, MAX_TREE)}\n… (cut)`;
  }
  return `Page: ${page.url()}\nTitle: ${await page.title().catch(() => '')}\n\n${tree}`;
}

const quote = (value) => `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

// A target as the locator a test would write, and the code for it: { locator, code }. A target is a Playwright
// locator chain as text (`getByRole('button', { name: 'Add' })`), or { role, name, label, placeholder, text,
// testId, nth } with one way of naming the element.
function locate(page, target) {
  if (typeof target === 'string') {
    return { locator: buildLocator(page, parseLocator(target)), code: `page.${target}` };
  }
  const { role, name, label, placeholder, text, testId, nth } = target ?? {};
  let found;
  if (role) {
    found = {
      locator: page.getByRole(role, name ? { name, exact: true } : {}),
      code: name
        ? `page.getByRole(${quote(role)}, { name: ${quote(name)}, exact: true })`
        : `page.getByRole(${quote(role)})`,
    };
  } else if (label) {
    found = {
      locator: page.getByLabel(label, { exact: true }),
      code: `page.getByLabel(${quote(label)}, { exact: true })`,
    };
  } else if (placeholder) {
    found = {
      locator: page.getByPlaceholder(placeholder, { exact: true }),
      code: `page.getByPlaceholder(${quote(placeholder)}, { exact: true })`,
    };
  } else if (text) {
    found = { locator: page.getByText(text, { exact: true }), code: `page.getByText(${quote(text)}, { exact: true })` };
  } else if (testId) {
    found = { locator: page.getByTestId(testId), code: `page.getByTestId(${quote(testId)})` };
  } else {
    throw new Error('The target names nothing: give a locator, or role (and name), label, placeholder, text or testId');
  }
  return Number.isInteger(nth) ? { locator: found.locator.nth(nth), code: `${found.code}.nth(${nth})` } : found;
}

// A URL the session may open: http or https, or a path of the app. file:, data:, javascript: would load what is
// not the app.
function checkUrl(url) {
  if (typeof url !== 'string' || url.trim() === '') {
    throw new Error('goto takes a URL or a path');
  }
  let absolute = null;
  try {
    absolute = new URL(url);
  } catch {
    // A path of the app.
  }
  if (absolute && !['http:', 'https:'].includes(absolute.protocol) && url !== 'about:blank') {
    throw new Error(`Navigation goes only to http and https addresses, not ${absolute.protocol}`);
  }
  return url;
}

const ACTIONS = ['click', 'fill', 'press', 'select_option', 'set_checked', 'hover', 'goto'];

// Does one action on the page, as a test would: { action, target, value }.
async function perform(page, { action, target, value }) {
  const timeout = ACTION_TIMEOUT;
  switch (action) {
    case 'goto':
      return page.goto(checkUrl(value), { timeout: 30_000 });
    case 'press':
      return target === undefined
        ? page.keyboard.press(String(value))
        : locate(page, target).locator.press(String(value), { timeout });
    case 'click':
      return locate(page, target).locator.click({ timeout });
    case 'hover':
      return locate(page, target).locator.hover({ timeout });
    case 'fill':
      return locate(page, target).locator.fill(String(value ?? ''), { timeout });
    case 'select_option':
      return locate(page, target).locator.selectOption({ label: String(value) }, { timeout });
    case 'set_checked':
      return locate(page, target).locator.setChecked(value !== false && value !== 'false', { timeout });
    default:
      throw new Error(`There is no ${action} action: ${ACTIONS.join(', ')}`);
  }
}

module.exports = { observe, locate, perform, ACTIONS };
