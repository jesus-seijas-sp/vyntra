const { commandsFor } = require('./playwright-commands');

// Browser mode on Playwright: a browser, and a context of its own for every test file's page.

const BROWSERS = ['chromium', 'firefox', 'webkit'];

function playwrightOf(rootDir) {
  try {
    // eslint-disable-next-line global-require -- the project's Playwright
    return require(require.resolve('playwright', { paths: [rootDir] }));
  } catch {
    try {
      // eslint-disable-next-line global-require -- the peer installed with @vyntra/web
      return require('playwright');
    } catch {
      throw new Error(
        'Browser mode runs on Playwright: npm install --save-dev playwright, then npx playwright install chromium'
      );
    }
  }
}

class PlaywrightProvider {
  // options: { name, headless, viewport, providerOptions }, from the project's browser config.
  constructor(options, { rootDir }) {
    if (!BROWSERS.includes(options.name)) {
      throw new Error(`browser ${options.name}: Playwright runs chromium, firefox or webkit`);
    }
    this.options = options;
    this.rootDir = rootDir;
    this.contexts = new Set();
  }

  // Chromium's V8 coverage, as Node's.
  get coverage() {
    return this.options.name === 'chromium';
  }

  // eslint-disable-next-line class-methods-use-this -- part of the provider's interface
  get lanes() {
    return Infinity;
  }

  async launch() {
    const { name, headless, providerOptions } = this.options;
    this.browser = await playwrightOf(this.rootDir)[name].launch({
      headless,
      ...(providerOptions.launch ?? providerOptions.launchOptions ?? {}),
    });
  }

  // The page of one test file (lanes share the browser): { goto, command, startCoverage, takeCoverage, close }.
  async open({ file }) {
    const context = await this.browser.newContext({
      viewport: this.options.viewport,
      ...(this.options.providerOptions.contextOptions ?? {}),
    });
    this.contexts.add(context);
    const page = await context.newPage();
    return {
      goto: (url) => page.goto(url),
      command: commandsFor(page, { rootDir: this.rootDir, file }),
      startCoverage: () => page.coverage.startJSCoverage({ resetOnNavigation: false }),
      takeCoverage: () => page.coverage.stopJSCoverage(),
      close: async () => {
        this.contexts.delete(context);
        await context.close().catch(() => {});
      },
    };
  }

  async close() {
    await Promise.all([...this.contexts].map((context) => context.close().catch(() => {})));
    await this.browser?.close().catch(() => {});
  }
}

module.exports = { PlaywrightProvider };
