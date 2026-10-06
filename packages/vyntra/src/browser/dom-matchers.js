// The DOM matchers of @testing-library/jest-dom that browser tests use most, which vitest's browser mode has, for
// elements (and for expect.element). A project that loads jest-dom itself gets its own.

const normalize = (text) =>
  String(text ?? '')
    .replace(/\s+/g, ' ')
    .trim();

const isElement = (value) => typeof Element !== 'undefined' && value instanceof Element;

function check(ctx, name, received, pass, describe) {
  if (!isElement(received) && name !== 'toBeInTheDocument') {
    throw new TypeError(`${name} takes an element, not ${received === null ? 'null' : typeof received}`);
  }
  return {
    pass,
    message: () =>
      `${ctx.hint(name, '')}\n\n${ctx.isNot ? 'Expected not: ' : 'Expected: '}${describe}\nReceived: ${received?.outerHTML?.slice(0, 200) ?? String(received)}`,
  };
}

const isVisible = (element) =>
  typeof element.checkVisibility === 'function'
    ? element.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })
    : element.getClientRects().length > 0;

const textMatches = (text, expected) =>
  expected instanceof RegExp ? expected.test(normalize(text)) : normalize(text).includes(normalize(expected));

const domMatchers = {
  toBeInTheDocument(received) {
    const pass = isElement(received) && received.ownerDocument.contains(received);
    return check(this, 'toBeInTheDocument', received, pass, 'an element in the document');
  },
  toBeVisible(received) {
    return check(this, 'toBeVisible', received, received.isConnected && isVisible(received), 'a visible element');
  },
  toBeEmptyDOMElement(received) {
    return check(this, 'toBeEmptyDOMElement', received, received.innerHTML === '', 'an empty element');
  },
  toBeDisabled(received) {
    const pass = received.disabled === true || received.closest('fieldset[disabled]') !== null;
    return check(this, 'toBeDisabled', received, pass, 'a disabled element');
  },
  toBeEnabled(received) {
    const pass = !(received.disabled === true || received.closest('fieldset[disabled]') !== null);
    return check(this, 'toBeEnabled', received, pass, 'an enabled element');
  },
  toBeChecked(received) {
    const pass = received.checked === true || received.getAttribute('aria-checked') === 'true';
    return check(this, 'toBeChecked', received, pass, 'a checked element');
  },
  toHaveFocus(received) {
    return check(
      this,
      'toHaveFocus',
      received,
      received.ownerDocument.activeElement === received,
      'the focused element'
    );
  },
  toHaveTextContent(received, expected) {
    return check(
      this,
      'toHaveTextContent',
      received,
      textMatches(received.textContent, expected),
      `text ${String(expected)}`
    );
  },
  toHaveValue(received, expected) {
    const number = received.value === '' ? null : Number(received.value);
    const value = received.type === 'number' ? number : received.value;
    return check(this, 'toHaveValue', received, this.equals(value, expected), `value ${JSON.stringify(expected)}`);
  },
  toHaveAttribute(received, name, expected) {
    const has = received.hasAttribute(name);
    const pass = expected === undefined ? has : has && this.equals(received.getAttribute(name), expected);
    return check(
      this,
      'toHaveAttribute',
      received,
      pass,
      expected === undefined ? `attribute ${name}` : `${name}="${expected}"`
    );
  },
  toHaveClass(received, ...names) {
    const pass =
      names.length === 0
        ? received.classList.length > 0
        : names.flatMap((name) => name.split(/\s+/)).every((name) => received.classList.contains(name));
    return check(this, 'toHaveClass', received, pass, `class ${names.join(' ')}`);
  },
  toHaveStyle(received, expected) {
    const style = getComputedStyle(received);
    const wanted =
      typeof expected === 'string'
        ? Object.fromEntries(
            expected
              .split(';')
              .filter((rule) => rule.includes(':'))
              .map((rule) => rule.split(':').map((part) => part.trim()))
          )
        : expected;
    const probe = document.createElement('div');
    const pass = Object.entries(wanted).every(([property, value]) => {
      const name = property.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`);
      probe.style.setProperty(name, value);
      const normalized = probe.style.getPropertyValue(name);
      return style.getPropertyValue(name) === normalized || style.getPropertyValue(name) === String(value);
    });
    return check(this, 'toHaveStyle', received, pass, JSON.stringify(wanted));
  },
  toContainElement(received, element) {
    return check(
      this,
      'toContainElement',
      received,
      element !== null && received.contains(element),
      'an element inside it'
    );
  },
};

module.exports = { domMatchers };
