const { screenshotPath, screenshotResult } = require('./screenshot-path');

// What a page of browser mode asks Node for (userEvent, page.screenshot, locators' actions), done with WebdriverIO.
// The page has already found the element a locator means, and marked it: commands get its CSS selector ({ css }).

// testing-library's names of keys, as WebdriverIO's Key has them.
const KEY_NAMES = { Meta: 'Command', ' ': 'Space', Esc: 'Escape' };

function keyOf(Key, name) {
  const key = Key[KEY_NAMES[name] ?? name];
  if (key !== undefined) {
    return key;
  }
  if ([...name].length === 1) {
    return name;
  }
  throw new Error(`browser mode does not know the key {${name}}`);
}

// "{Enter}", "{Shift>}a{/Shift}", or text: testing-library's keyboard syntax, as one action of key presses, so a
// key held down ({Shift>}) is down for the keys after it.
function keyboard(browser, Key, text) {
  const action = (text.match(/\{[^}]+\}|[^{]+/g) ?? []).reduce((keys, token) => {
    if (!token.startsWith('{')) {
      return [...token].reduce((typed, char) => typed.down(char).up(char), keys);
    }
    const name = token.slice(1, -1);
    if (name.endsWith('>')) {
      return keys.down(keyOf(Key, name.slice(0, -1)));
    }
    if (name.startsWith('/')) {
      return keys.up(keyOf(Key, name.slice(1)));
    }
    const key = keyOf(Key, name);
    return keys.down(key).up(key);
  }, browser.action('key'));
  return action.perform();
}

// As Playwright's selectOption: the options whose value or label is one of the values, and only those, selected,
// with the input and change events a user's choice sends.
function selectInPage(css, values) {
  const select = globalThis.document.querySelector(css);
  const options = [...select.options];
  const chosen = values.map((value) => {
    const option = options.find((one) => one.value === value) ?? options.find((one) => one.label === value);
    if (!option) {
      throw new Error(`No option of the select has the value or label ${JSON.stringify(value)}`);
    }
    return option;
  });
  options.forEach((option) => {
    Object.assign(option, { selected: chosen.includes(option) });
  });
  select.dispatchEvent(new Event('input', { bubbles: true }));
  select.dispatchEvent(new Event('change', { bubbles: true }));
  return chosen.map((option) => option.value);
}

function commandsFor(browser, { Key, rootDir, file, setViewport }) {
  const $ = (target) => browser.$(target.css);
  const handlers = {
    click: async (target, options = {}) => {
      const clicks = options?.clickCount ?? 1;
      if (clicks === 1) {
        return $(target).click();
      }
      if (clicks === 2) {
        return $(target).doubleClick();
      }
      const pointer = browser.action('pointer', { parameters: { pointerType: 'mouse' } }).move({ origin: $(target) });
      return Array.from({ length: clicks })
        .reduce((action) => action.down().up().pause(50), pointer)
        .perform();
    },
    hover: (target) => $(target).moveTo(),
    unhover: () => browser.action('pointer').move({ x: 0, y: 0 }).perform(),
    fill: (target, text) => (String(text) === '' ? $(target).clearValue() : $(target).setValue(String(text))),
    type: async (target, text) => {
      const element = $(target);
      if (!(await element.isFocused())) {
        await element.click();
      }
      await keyboard(browser, Key, String(text));
    },
    selectOptions: (target, values) => browser.execute(selectInPage, target.css, [values].flat().map(String)),
    keyboard: (text) => keyboard(browser, Key, String(text)),
    tab: (options) => browser.keys(options?.shift ? [Key.Shift, Key.Tab] : [Key.Tab]),
    viewport: (width, height) => setViewport({ width, height }),
    screenshot: async (options = {}) => {
      const target = screenshotPath(file, options);
      await (options.target
        ? $(options.target).saveScreenshot(target)
        : browser.saveScreenshot(target, { fullPage: Boolean(options.fullPage) }));
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

module.exports = { commandsFor, keyboard };
