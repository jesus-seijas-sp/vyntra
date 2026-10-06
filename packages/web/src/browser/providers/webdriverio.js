const Module = require('node:module');
const path = require('node:path');
const { commandsFor } = require('./webdriverio-commands');

// Browser mode on WebdriverIO: a WebDriver session for each lane, which runs its test files one after the other,
// each on a fresh page of the project's origin (its storage and cookies cleared after it).

const BROWSERS = ['chrome', 'firefox', 'edge', 'safari'];
// Playwright's names, for a config that keeps them.
const ALIASES = { chromium: 'chrome', webkit: 'safari', msedge: 'edge' };
const HEADLESS = {
  chrome: ['goog:chromeOptions', ['headless=new', 'disable-gpu']],
  firefox: ['moz:firefoxOptions', ['-headless']],
  edge: ['ms:edgeOptions', ['--headless']],
};
const CAPABILITY_NAMES = { edge: 'MicrosoftEdge' };

function webdriverioOf(rootDir) {
  try {
    return Module.createRequire(path.join(rootDir, 'package.json'))('webdriverio');
  } catch {
    try {
      // eslint-disable-next-line global-require -- the peer installed with @vyntra/web
      return require('webdriverio');
    } catch {
      throw new Error('The webdriverio provider runs on WebdriverIO: npm install --save-dev webdriverio');
    }
  }
}

// vitest's: the provider's capabilities, the browser's name, and its headless arguments added to its own.
function capabilitiesOf(name, { headless, explicitHeadless, providerOptions }) {
  if (name === 'safari' && explicitHeadless) {
    throw new Error('Safari has no headless mode: set browser.headless to false');
  }
  const capabilities = { ...providerOptions.capabilities, browserName: CAPABILITY_NAMES[name] ?? name };
  if (headless && HEADLESS[name]) {
    const [key, args] = HEADLESS[name];
    const own = capabilities[key] ?? {};
    capabilities[key] = { ...own, args: [...new Set([...(own.args ?? []), ...args])] };
  }
  return capabilities;
}

class WebdriverioProvider {
  constructor(options, { rootDir }) {
    const name = ALIASES[options.name] ?? options.name;
    if (!BROWSERS.includes(name)) {
      throw new Error(`browser ${options.name}: WebdriverIO runs chrome, firefox, edge or safari`);
    }
    this.name = name;
    this.options = options;
    this.rootDir = rootDir;
    this.sessions = [];
  }

  // Coverage needs Chromium's DevTools protocol, which vyntra takes through Playwright.
  // eslint-disable-next-line class-methods-use-this -- part of the provider's interface
  get coverage() {
    return false;
  }

  async launch() {
    this.webdriverio = webdriverioOf(this.rootDir);
  }

  // A session per lane, started when the lane first needs it.
  session(lane) {
    this.sessions[lane] ??= (async () => {
      const { capabilities: _, ...remoteOptions } = this.options.providerOptions;
      const browser = await this.webdriverio.remote({
        logLevel: 'silent',
        ...remoteOptions,
        capabilities: capabilitiesOf(this.name, this.options),
      });
      return browser;
    })();
    return this.sessions[lane];
  }

  async open({ file, lane }) {
    const browser = await this.session(lane);
    // Through WebDriver BiDi when the session has it; the window's size otherwise.
    const setViewport = (viewport) =>
      browser.isBidi ? browser.setViewport(viewport) : browser.setWindowSize(viewport.width, viewport.height);
    await setViewport(this.options.viewport);
    return {
      goto: (url) => browser.url(url),
      command: commandsFor(browser, { Key: this.webdriverio.Key, rootDir: this.rootDir, file, setViewport }),
      close: async () => {
        // The next file starts as a new context would in Playwright: no storage or cookies of this one.
        await browser
          .execute(() => {
            localStorage.clear();
            sessionStorage.clear();
          })
          .catch(() => {});
        await browser.deleteAllCookies().catch(() => {});
        await browser.url('about:blank').catch(() => {});
      },
    };
  }

  async close() {
    await Promise.all(
      this.sessions.map(async (session) => {
        const browser = await session.catch(() => null);
        await browser?.deleteSession().catch(() => {});
      })
    );
  }
}

module.exports = { WebdriverioProvider, capabilitiesOf };
