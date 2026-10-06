// `vitest/browser` (and `@vitest/browser/context`) in a page of browser mode: page, userEvent, locators and
// expect.element. Actions (a click, typing, a screenshot) are the provider's (Playwright or WebdriverIO), asked for
// through a function the runner gives the page; locators find their elements in the page itself, as vitest's do.

const runtimeState = require('../state');
const { expect } = require('../expect');
const { realTimers } = require('../timers/real-timers');

const providerName = () => runtimeState.config?.browserProvider ?? 'playwright';

// Locators in a command's arguments (and in its options' target), as the provider finds elements.
/* eslint-disable no-use-before-define -- Locator's methods send commands */
const command = async (name, ...args) => {
  const resolve = (arg) => (arg instanceof Locator ? targetFor(arg) : arg);
  const resolved = await Promise.all(
    args.map(async (arg) =>
      arg && typeof arg === 'object' && arg.target instanceof Locator
        ? { ...arg, target: await resolve(arg.target) }
        : resolve(arg)
    )
  );
  return globalThis.__vyntraCommand(name, resolved);
};
/* eslint-enable no-use-before-define */

// RegExps cross to Node as their source and flags.
const portable = (value) => {
  if (value instanceof RegExp) {
    return { regexp: value.source, flags: value.flags };
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return Object.fromEntries(Object.entries(value).map(([key, one]) => [key, portable(one)]));
  }
  return value;
};

const normalize = (text) =>
  String(text ?? '')
    .replace(/\s+/g, ' ')
    .trim();

function matches(text, expected, exact) {
  const value = normalize(text);
  if (expected instanceof RegExp) {
    return expected.test(value);
  }
  return exact ? value === normalize(expected) : value.toLowerCase().includes(normalize(expected).toLowerCase());
}

const isVisible = (element) =>
  typeof element.checkVisibility === 'function'
    ? element.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })
    : element.getClientRects().length > 0;

const TEXT_INPUTS = new Set(['text', 'email', 'tel', 'url', 'password', '']);

// The implicit ARIA roles of the elements tests usually look for.
function roleOf(element) {
  const explicit = element.getAttribute('role');
  if (explicit) {
    return explicit.split(/\s+/)[0];
  }
  const tag = element.localName;
  const type = (element.getAttribute('type') ?? '').toLowerCase();
  switch (tag) {
    case 'a':
    case 'area':
      return element.hasAttribute('href') ? 'link' : null;
    case 'button':
      return 'button';
    case 'input':
      if (['button', 'submit', 'reset', 'image'].includes(type)) return 'button';
      if (type === 'checkbox') return 'checkbox';
      if (type === 'radio') return 'radio';
      if (type === 'range') return 'slider';
      if (type === 'number') return 'spinbutton';
      if (type === 'search') return 'searchbox';
      return TEXT_INPUTS.has(type) ? 'textbox' : null;
    case 'textarea':
      return 'textbox';
    case 'select':
      return element.multiple || element.size > 1 ? 'listbox' : 'combobox';
    case 'option':
      return 'option';
    case 'h1':
    case 'h2':
    case 'h3':
    case 'h4':
    case 'h5':
    case 'h6':
      return 'heading';
    case 'ul':
    case 'ol':
      return 'list';
    case 'li':
      return 'listitem';
    case 'img':
      return element.getAttribute('alt') === '' ? 'presentation' : 'img';
    case 'nav':
      return 'navigation';
    case 'main':
      return 'main';
    case 'aside':
      return 'complementary';
    case 'dialog':
      return 'dialog';
    case 'form':
      return 'form';
    case 'table':
      return 'table';
    case 'tr':
      return 'row';
    case 'td':
      return 'cell';
    case 'th':
      return 'columnheader';
    case 'progress':
      return 'progressbar';
    case 'header':
      return element.closest('article, aside, main, nav, section') ? null : 'banner';
    case 'footer':
      return element.closest('article, aside, main, nav, section') ? null : 'contentinfo';
    default:
      return null;
  }
}

function labelsOf(element) {
  const byFor = element.id ? [...element.ownerDocument.querySelectorAll(`label[for="${CSS.escape(element.id)}"]`)] : [];
  const wrapping = element.closest('label');
  return [...byFor, ...(wrapping ? [wrapping] : [])];
}

// The accessible name, as far as tests need it: aria-labelledby, aria-label, labels, alt, the text, title.
function nameOf(element) {
  const labelledBy = element.getAttribute('aria-labelledby');
  if (labelledBy) {
    return labelledBy
      .split(/\s+/)
      .map((id) => element.ownerDocument.getElementById(id)?.textContent ?? '')
      .join(' ');
  }
  const label = element.getAttribute('aria-label');
  if (label) {
    return label;
  }
  if (['input', 'textarea', 'select'].includes(element.localName)) {
    const labels = labelsOf(element);
    if (labels.length > 0) {
      return labels.map((one) => one.textContent).join(' ');
    }
    if (['button', 'submit', 'reset'].includes(element.type)) {
      return element.value;
    }
    return element.getAttribute('title') ?? element.getAttribute('placeholder') ?? '';
  }
  if (element.localName === 'img') {
    return element.getAttribute('alt') ?? '';
  }
  return element.textContent || element.getAttribute('title') || '';
}

const STATES = {
  checked: (element) => element.checked ?? element.getAttribute('aria-checked') === 'true',
  pressed: (element) => element.getAttribute('aria-pressed') === 'true',
  expanded: (element) => element.getAttribute('aria-expanded') === 'true',
  selected: (element) => element.selected ?? element.getAttribute('aria-selected') === 'true',
  disabled: (element) => element.disabled === true || element.getAttribute('aria-disabled') === 'true',
};

// The elements a description finds under root: { by, value, options }.
function find(root, { by, value, options = {} }) {
  const all = [...root.querySelectorAll('*')];
  switch (by) {
    // An element's own mark (page.elementLocator).
    case 'ref':
      return [...root.querySelectorAll(value)];
    case 'testId':
      return all.filter((element) => element.getAttribute('data-testid') === value);
    case 'placeholder':
      return all.filter(
        (element) =>
          element.hasAttribute('placeholder') && matches(element.getAttribute('placeholder'), value, options.exact)
      );
    case 'alt':
      return all.filter(
        (element) => element.hasAttribute('alt') && matches(element.getAttribute('alt'), value, options.exact)
      );
    case 'title':
      return all.filter(
        (element) => element.hasAttribute('title') && matches(element.getAttribute('title'), value, options.exact)
      );
    case 'label':
      return all.filter((element) =>
        ['input', 'textarea', 'select'].includes(element.localName) ||
        element.hasAttribute('aria-label') ||
        element.hasAttribute('aria-labelledby')
          ? matches(nameOf(element), value, options.exact)
          : false
      );
    case 'text': {
      const found = all.filter(
        (element) =>
          !['script', 'style'].includes(element.localName) && matches(element.textContent, value, options.exact)
      );
      // The innermost elements with the text, not every ancestor of it.
      return found.filter((element) => !found.some((other) => other !== element && element.contains(other)));
    }
    case 'role':
      return all.filter((element) => {
        if (roleOf(element) !== value || (!options.includeHidden && !isVisible(element))) {
          return false;
        }
        if (options.name !== undefined && !matches(nameOf(element), options.name, options.exact)) {
          return false;
        }
        if (
          options.level !== undefined &&
          Number(element.localName.slice(1) || element.getAttribute('aria-level')) !== options.level
        ) {
          return false;
        }
        return Object.keys(STATES).every(
          (state) => options[state] === undefined || STATES[state](element) === options[state]
        );
      });
    default:
      return [];
  }
}

let refs = 0;

// A selector Playwright finds an element by: the element marked with a number of its own.
// Playwright finds a locator's element itself, waiting for it, by the same getBy... WebdriverIO has none of them:
// the page waits for the one element the locator means and marks it, as vitest's provider does.
async function targetFor(locator) {
  if (providerName() === 'playwright') {
    return locator.target;
  }
  const deadline = realTimers.performanceNow() + (runtimeState.config?.testTimeout ?? 5000);
  for (;;) {
    const found = locator.elements();
    if (found.length > 1) {
      throw new Error(`The locator ${locator} matches ${found.length} elements; an action needs one`);
    }
    if (found.length === 1) {
      // eslint-disable-next-line no-use-before-define -- marks the element
      return refOf(found[0]);
    }
    if (realTimers.performanceNow() >= deadline) {
      throw new Error(`Nothing matches the locator ${locator}`);
    }
    // eslint-disable-next-line no-await-in-loop -- asked again until the page has it
    await new Promise((resolve) => {
      realTimers.setTimeout(resolve, 50);
    });
  }
}

function refOf(element) {
  if (!element.hasAttribute('data-vyntra-ref')) {
    refs += 1;
    element.setAttribute('data-vyntra-ref', String(refs));
  }
  return { css: `[data-vyntra-ref="${element.getAttribute('data-vyntra-ref')}"]` };
}

class Locator {
  constructor(description, parent = null, nth = null) {
    this.description = description;
    this.parent = parent;
    this.position = nth;
  }

  // What Node finds it by: Playwright's own getBy... with the same arguments.
  get target() {
    return { ...portable(this.description), parent: this.parent?.target ?? null, nth: this.position };
  }

  elements() {
    const roots = this.parent ? this.parent.elements() : [document.body];
    const found = [...new Set(roots.flatMap((root) => find(root, this.description)))];
    if (this.position === null) {
      return found;
    }
    const at = this.position < 0 ? found.length + this.position : this.position;
    return found[at] ? [found[at]] : [];
  }

  query() {
    const found = this.elements();
    if (found.length > 1) {
      throw new Error(`The locator ${this} matches ${found.length} elements, not one`);
    }
    return found[0] ?? null;
  }

  element() {
    const found = this.query();
    if (!found) {
      throw new Error(`Nothing matches the locator ${this}`);
    }
    return found;
  }

  all() {
    return this.elements().map((_, i) => new Locator(this.description, this.parent, i));
  }

  nth(index) {
    return new Locator(this.description, this.parent, index);
  }

  first() {
    return this.nth(0);
  }

  last() {
    return this.nth(-1);
  }

  toString() {
    const { by, value, options } = this.description;
    const args = [value, ...(options && Object.keys(options).length > 0 ? [options] : [])].map((arg) =>
      arg instanceof RegExp ? String(arg) : JSON.stringify(arg)
    );
    return `${this.parent ? `${this.parent}.` : ''}getBy${by[0].toUpperCase()}${by.slice(1)}(${args.join(', ')})${this.position === null ? '' : `.nth(${this.position})`}`;
  }

  click(options) {
    return command('click', this, options);
  }

  dblClick(options) {
    return command('click', this, { ...options, clickCount: 2 });
  }

  tripleClick(options) {
    return command('click', this, { ...options, clickCount: 3 });
  }

  hover(options) {
    return command('hover', this, options);
  }

  // Moves the pointer off the page, wherever this locator is.
  // eslint-disable-next-line class-methods-use-this
  unhover() {
    return command('unhover');
  }

  fill(text) {
    return command('fill', this, text);
  }

  clear() {
    return command('fill', this, '');
  }

  selectOptions(values) {
    return command('selectOptions', this, values);
  }

  screenshot(options) {
    return command('screenshot', { ...options, target: this });
  }
}

const by = (name) => (value, options) => new Locator({ by: name, value, options });
const locators = {
  getByRole: by('role'),
  getByText: by('text'),
  getByLabelText: by('label'),
  getByPlaceholder: by('placeholder'),
  getByAltText: by('alt'),
  getByTitle: by('title'),
  getByTestId: by('testId'),
};
Object.keys(locators).forEach((name) => {
  Locator.prototype[name] = function scoped(value, options) {
    return new Locator(locators[name](value, options).description, this);
  };
});

const targetOf = (subject) => (subject instanceof Locator ? subject : refOf(subject));

const userEvent = {
  setup: () => userEvent,
  click: (subject, options) => command('click', targetOf(subject), options),
  dblClick: (subject, options) => command('click', targetOf(subject), { ...options, clickCount: 2 }),
  tripleClick: (subject, options) => command('click', targetOf(subject), { ...options, clickCount: 3 }),
  hover: (subject, options) => command('hover', targetOf(subject), options),
  unhover: () => command('unhover'),
  fill: (subject, text) => command('fill', targetOf(subject), text),
  clear: (subject) => command('fill', targetOf(subject), ''),
  type: (subject, text) => command('type', targetOf(subject), text),
  selectOptions: (subject, values) =>
    command(
      'selectOptions',
      targetOf(subject),
      [values].flat().map((value) => (value instanceof Element ? value.value : value))
    ),
  keyboard: (text) => command('keyboard', text),
  tab: (options) => command('tab', options),
};

const page = {
  ...locators,
  viewport: (width, height) => command('viewport', width, height),
  screenshot: (options) => command('screenshot', options),
  elementLocator: (element) => new Locator({ by: 'ref', value: refOf(element).css }),
};

const server = {
  platform: 'browser',
  get provider() {
    return providerName();
  },
  config: {},
};
const commands = {};

// expect.element(locator or element): the assertion, retried until it passes or the time is up (1s), as the page
// gets where the test expects it.
function expectElement(subject, { timeout = 1000, interval = 50 } = {}) {
  const make = (negate) =>
    new Proxy(
      {},
      {
        get(_, name) {
          if (name === 'not') {
            return make(!negate);
          }
          return async (...args) => {
            // The real clock: a test's fake timers would stop this one.
            const deadline = realTimers.performanceNow() + timeout;
            for (;;) {
              try {
                const target = subject instanceof Locator ? subject.query() : subject;
                const assertion = expect(target);
                (negate ? assertion.not : assertion)[name](...args);
                return;
              } catch (error) {
                if (realTimers.performanceNow() >= deadline) {
                  throw error;
                }
              }
              // eslint-disable-next-line no-await-in-loop -- asked again until it passes
              await new Promise((resolve) => {
                realTimers.setTimeout(resolve, interval);
              });
            }
          };
        },
      }
    );
  return make(false);
}

module.exports = { page, userEvent, server, commands, Locator, expectElement, roleOf, nameOf };
