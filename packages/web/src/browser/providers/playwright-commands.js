const { screenshotPath, screenshotResult } = require('./screenshot-path');

// What a page of browser mode asks Node for (userEvent, page.screenshot, locators' actions): done with Playwright,
// on the page the test runs in.

// RegExps come from the page as their source and flags.
const revive = (value) => {
  if (value && typeof value === 'object' && typeof value.regexp === 'string') {
    return new RegExp(value.regexp, value.flags);
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return Object.fromEntries(Object.entries(value).map(([key, one]) => [key, revive(one)]));
  }
  return value;
};

const BY = {
  role: 'getByRole',
  text: 'getByText',
  label: 'getByLabel',
  placeholder: 'getByPlaceholder',
  alt: 'getByAltText',
  title: 'getByTitle',
  testId: 'getByTestId',
};

// The Playwright locator of what the page describes: an element it marked ({ css }), or getBy... from a parent.
function locatorOf(page, target) {
  if (target.css) {
    return page.locator(target.css);
  }
  const base = target.parent ? locatorOf(page, target.parent) : page;
  const { by, value, options } = revive(target);
  let locator = by === 'ref' ? base.locator(value) : base[BY[by]](value, options ?? undefined);
  if (target.nth !== null && target.nth !== undefined) {
    locator = target.nth < 0 ? locator.nth(target.nth) : locator.nth(target.nth);
  }
  return locator;
}

// "{Enter}", "{Shift>}a{/Shift}", or text: testing-library's keyboard syntax, as Playwright keys.
function pressOne(page, token) {
  if (!token.startsWith('{')) {
    return page.keyboard.type(token);
  }
  const key = token.slice(1, -1);
  if (key.endsWith('>')) {
    return page.keyboard.down(key.slice(0, -1));
  }
  return key.startsWith('/') ? page.keyboard.up(key.slice(1)) : page.keyboard.press(key);
}

// Keys in order.
const keyboard = (page, text) =>
  (text.match(/\{[^}]+\}|[^{]+/g) ?? []).reduce(
    (previous, token) => previous.then(() => pressOne(page, token)),
    Promise.resolve()
  );

function commandsFor(page, { rootDir, file }) {
  const handlers = {
    click: (target, options) => locatorOf(page, target).click(options ?? undefined),
    hover: (target, options) => locatorOf(page, target).hover(options ?? undefined),
    unhover: () => page.mouse.move(0, 0),
    fill: (target, text) => locatorOf(page, target).fill(String(text)),
    type: async (target, text) => {
      const locator = locatorOf(page, target);
      await locator.focus();
      await keyboard(page, String(text));
    },
    selectOptions: (target, values) => locatorOf(page, target).selectOption(values),
    keyboard: (text) => keyboard(page, String(text)),
    tab: (options) => page.keyboard.press(options?.shift ? 'Shift+Tab' : 'Tab'),
    viewport: (width, height) => page.setViewportSize({ width, height }),
    screenshot: async (options = {}) => {
      const target = screenshotPath(file, options);
      const subject = options.target ? locatorOf(page, options.target) : page;
      await subject.screenshot({ path: target, ...(options.target ? {} : { fullPage: options.fullPage }) });
      return screenshotResult(rootDir, target, options);
    },
  };
  return async (name, args) => {
    if (!handlers[name]) {
      throw new Error(`browser mode has no command "${name}"`);
    }
    // Arguments the page left out come as null (JSON's): as undefined, they take the handlers' defaults.
    return handlers[name](...(args ?? []).map((arg) => arg ?? undefined));
  };
}

module.exports = { commandsFor, locatorOf };
