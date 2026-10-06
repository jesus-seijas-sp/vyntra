// The fixtures of web tests: a browser per worker, and a fresh context and page per test. A test that fails leaves
// what explains it on its failure page: a screenshot, the page's accessibility tree, its console and network, and
// a Playwright trace.

const KEPT_LINES = 100;
const BROWSERS = ['chromium', 'firefox', 'webkit'];
const TRACE_MODES = ['off', 'on', 'on-failure', 'retain-on-failure'];

// Playwright is the project's: a peer dependency, loaded when the first test needs a browser.
function playwright() {
  try {
    // eslint-disable-next-line global-require -- only the projects that run web tests load it
    return require('playwright');
  } catch (error) {
    if (error.code === 'MODULE_NOT_FOUND') {
      throw new Error(
        'Web tests run on Playwright: install it (npm install --save-dev playwright, then npx playwright install chromium)'
      );
    }
    throw error;
  }
}

// The last lines of something a page keeps saying.
function lineLog() {
  const lines = [];
  return {
    add(line) {
      lines.push(line);
      if (lines.length > KEPT_LINES) {
        lines.shift();
      }
    },
    text: () => lines.join('\n'),
    get size() {
      return lines.length;
    },
  };
}

// Saves what a failed test's page shows, each step on its own: a page that crashed still gets the rest.
async function saveEvidence(page, testInfo, { screenshot, console: consoleLog, network }) {
  const attempt = async (fn) => {
    try {
      await fn();
    } catch {
      // The page may be gone (closed, crashed): what can be saved is.
    }
  };
  if (screenshot !== 'off') {
    await attempt(async () => {
      const file = testInfo.outputPath('screenshot.png');
      await page.screenshot({ path: file, fullPage: true, timeout: 5_000 });
      testInfo.attach('screenshot', { path: file, contentType: 'image/png' });
    });
  }
  await attempt(async () => {
    testInfo.attach('page', { body: page.url(), contentType: 'text/uri-list' });
  });
  await attempt(async () => {
    const tree = await page.locator('body').ariaSnapshot({ timeout: 5_000 });
    testInfo.attach('accessibility tree', { body: tree, contentType: 'text/yaml' });
  });
  if (consoleLog.size > 0) {
    testInfo.attach('console', { body: consoleLog.text() });
  }
  if (network.size > 0) {
    testInfo.attach('network', { body: network.text() });
  }
}

const fixtures = {
  browser: [
    async ({ browserName = 'chromium', headless = true, launchOptions }, use) => {
      if (!BROWSERS.includes(browserName)) {
        throw new Error(`use.browserName is ${browserName}: chromium, firefox or webkit`);
      }
      const browser = await playwright()[browserName].launch({ headless, ...launchOptions });
      await use(browser);
      await browser.close();
    },
    { scope: 'worker' },
  ],

  context: async ({ browser, baseURL, viewport, contextOptions, trace = 'off', testInfo }, use) => {
    if (!TRACE_MODES.includes(trace)) {
      throw new Error(`use.trace is ${trace}: ${TRACE_MODES.join(', ')}`);
    }
    const context = await browser.newContext({ baseURL, ...(viewport ? { viewport } : {}), ...contextOptions });
    const tracing = trace !== 'off';
    if (tracing) {
      await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
    }
    await use(context);
    if (tracing && (trace === 'on' || testInfo.failed)) {
      const file = testInfo.outputPath('trace.zip');
      await context.tracing.stop({ path: file });
      testInfo.attach('trace', { path: file, contentType: 'application/zip' });
    } else if (tracing) {
      await context.tracing.stop();
    }
    await context.close();
  },

  page: async ({ context, screenshot = 'only-on-failure', testInfo }, use) => {
    const page = await context.newPage();
    const consoleLog = lineLog();
    const network = lineLog();
    page.on('console', (message) => consoleLog.add(`${message.type()}: ${message.text()}`));
    page.on('pageerror', (error) => consoleLog.add(`uncaught: ${error.message}`));
    page.on('response', (response) =>
      network.add(`${response.status()} ${response.request().method()} ${response.url()}`)
    );
    page.on('requestfailed', (request) =>
      network.add(`failed ${request.method()} ${request.url()}: ${request.failure()?.errorText ?? 'no response'}`)
    );
    await use(page);
    if (testInfo.failed || screenshot === 'on') {
      await saveEvidence(page, testInfo, { screenshot, console: consoleLog, network });
    }
  },
};

module.exports = { fixtures };
