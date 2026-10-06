const { setTimeout: sleep } = require('node:timers/promises');

// Web-first assertions: they retry until the page agrees or the time runs out (`{ timeout }`, 5 seconds by default),
// so a test waits for the app instead of for a fixed time. They take a Playwright locator, or a page for
// toHaveURL and toHaveTitle.

const DEFAULT_TIMEOUT = 5_000;
const POLL_MS = 100;

const isLocator = (value) =>
  typeof value?.isVisible === 'function' &&
  typeof value?.allTextContents === 'function' &&
  typeof value?.page === 'function';
const isPage = (value) => typeof value?.goto === 'function' && typeof value?.url === 'function';

const normalize = (text) =>
  String(text ?? '')
    .replace(/\s+/g, ' ')
    .trim();

const show = (value) => (value instanceof RegExp ? String(value) : JSON.stringify(value));

function textMatches(actual, expected, partial) {
  if (expected instanceof RegExp) {
    return expected.test(actual);
  }
  const wanted = normalize(expected);
  return partial ? normalize(actual).includes(wanted) : normalize(actual) === wanted;
}

// Asks the page until the answer is the one wanted (or, under .not, until it is not), or the time is up. probe()
// returns { pass, actual }; a probe that throws (a locator matching several elements) counts as not passing.
async function retry(ctx, probe, options) {
  const timeout = options?.timeout ?? DEFAULT_TIMEOUT;
  const deadline = Date.now() + timeout;
  let last;
  for (;;) {
    try {
      // eslint-disable-next-line no-await-in-loop -- asked again until it agrees
      last = await probe();
    } catch (error) {
      last = { pass: false, actual: `(${error.message.split('\n')[0]})` };
    }
    if (last.pass !== ctx.isNot || Date.now() >= deadline) {
      return { ...last, timeout };
    }
    // eslint-disable-next-line no-await-in-loop
    await sleep(POLL_MS);
  }
}

// A matcher over a locator (or a page): what it asks, and how it reads the answer.
function webMatcher(name, { target = 'locator', probe, expected: describeExpected }) {
  return async function matcher(received, ...args) {
    const ok = target === 'page' ? isPage(received) : isLocator(received);
    if (!ok) {
      throw new TypeError(`${name} takes a Playwright ${target}, not ${typeof received}`);
    }
    const options = args.find(
      (arg) => arg && typeof arg === 'object' && !(arg instanceof RegExp) && !Array.isArray(arg)
    );
    const { pass, actual, timeout } = await retry(this, () => probe(received, ...args), options);
    const wanted = describeExpected ? describeExpected(...args) : null;
    return {
      pass,
      message: () =>
        [
          `${this.hint(name, wanted === null ? '' : 'expected')}`,
          '',
          `${target === 'page' ? 'Page' : 'Locator'}: ${target === 'page' ? received.url() : String(received)}`,
          wanted === null ? null : `${this.not('Expected:')} ${wanted}`,
          `Received: ${actual}`,
          '',
          `Waited ${timeout}ms.`,
        ]
          .filter((line) => line !== null)
          .join('\n'),
    };
  };
}

const state = (name, method, word) =>
  webMatcher(name, {
    probe: async (locator) => {
      const pass = await locator[method]();
      return { pass, actual: pass ? word : `not ${word}` };
    },
  });

const matchers = {
  toBeVisible: state('toBeVisible', 'isVisible', 'visible'),
  toBeHidden: state('toBeHidden', 'isHidden', 'hidden'),
  toBeEnabled: state('toBeEnabled', 'isEnabled', 'enabled'),
  toBeDisabled: state('toBeDisabled', 'isDisabled', 'disabled'),
  toBeChecked: state('toBeChecked', 'isChecked', 'checked'),
  toBeEditable: state('toBeEditable', 'isEditable', 'editable'),
  toBeFocused: webMatcher('toBeFocused', {
    probe: async (locator) => {
      const pass = await locator.evaluate((element) => element === element.ownerDocument.activeElement);
      return { pass, actual: pass ? 'focused' : 'not focused' };
    },
  }),
  toBeAttached: webMatcher('toBeAttached', {
    probe: async (locator) => {
      const count = await locator.count();
      return { pass: count > 0, actual: count > 0 ? 'attached' : 'not in the page' };
    },
  }),
  toHaveCount: webMatcher('toHaveCount', {
    probe: async (locator, count) => {
      const actual = await locator.count();
      return { pass: actual === count, actual };
    },
    expected: (count) => count,
  }),
  // The text of the element, or of each element for a list of texts.
  toHaveText: webMatcher('toHaveText', {
    probe: async (locator, expected) => {
      const texts = await locator.allTextContents();
      if (Array.isArray(expected)) {
        const pass = texts.length === expected.length && texts.every((text, i) => textMatches(text, expected[i]));
        return { pass, actual: JSON.stringify(texts.map(normalize)) };
      }
      if (texts.length !== 1) {
        return { pass: false, actual: `${texts.length} elements` };
      }
      return { pass: textMatches(texts[0], expected), actual: show(normalize(texts[0])) };
    },
    expected: (expected) => (Array.isArray(expected) ? JSON.stringify(expected) : show(expected)),
  }),
  toContainText: webMatcher('toContainText', {
    probe: async (locator, expected) => {
      const texts = await locator.allTextContents();
      const pass = texts.some((text) => textMatches(text, expected, true));
      return { pass, actual: texts.length === 1 ? show(normalize(texts[0])) : JSON.stringify(texts.map(normalize)) };
    },
    expected: (expected) => show(expected),
  }),
  toHaveValue: webMatcher('toHaveValue', {
    probe: async (locator, expected) => {
      const value = await locator.inputValue({ timeout: POLL_MS });
      return { pass: expected instanceof RegExp ? expected.test(value) : value === expected, actual: show(value) };
    },
    expected: (expected) => show(expected),
  }),
  toHaveAttribute: webMatcher('toHaveAttribute', {
    probe: async (locator, name, expected) => {
      const value = await locator.getAttribute(name, { timeout: POLL_MS });
      if (expected === undefined || (typeof expected === 'object' && !(expected instanceof RegExp))) {
        return { pass: value !== null, actual: value === null ? `no ${name}` : `${name}=${show(value)}` };
      }
      const pass = value !== null && (expected instanceof RegExp ? expected.test(value) : value === expected);
      return { pass, actual: value === null ? `no ${name}` : show(value) };
    },
    expected: (name, expected) =>
      expected === undefined || (typeof expected === 'object' && !(expected instanceof RegExp))
        ? name
        : `${name}=${show(expected)}`,
  }),
  toHaveClass: webMatcher('toHaveClass', {
    probe: async (locator, expected) => {
      const value = (await locator.getAttribute('class', { timeout: POLL_MS })) ?? '';
      const pass = expected instanceof RegExp ? expected.test(value) : normalize(value) === normalize(expected);
      return { pass, actual: show(value) };
    },
    expected: (expected) => show(expected),
  }),
  // A URL, a path from the page's origin ('/todos'), or a RegExp.
  toHaveURL: webMatcher('toHaveURL', {
    target: 'page',
    probe: async (page, expected) => {
      const url = page.url();
      const pass = expected instanceof RegExp ? expected.test(url) : new URL(expected, url).href === url;
      return { pass, actual: show(url) };
    },
    expected: (expected) => show(expected),
  }),
  toHaveTitle: webMatcher('toHaveTitle', {
    target: 'page',
    probe: async (page, expected) => {
      const title = await page.title();
      return { pass: textMatches(title, expected), actual: show(title) };
    },
    expected: (expected) => show(expected),
  }),
};

module.exports = { matchers, isLocator, isPage };
