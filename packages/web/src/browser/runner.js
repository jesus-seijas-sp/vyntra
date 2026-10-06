const http = require('node:http');
const { SourceMap } = require('node:module');
const path = require('node:path');
const { bundleTestFile, coreFiles } = require('./bundle');
const { commandsFor } = require('./commands');

// Vitest's browser mode: each test file runs in a real browser page, through Playwright. Its bundle (see bundle.js)
// is served from a local server (a page with an origin, as vitest's), each file in a browser context of its own,
// several at once; the page reports its result, which goes on as a Node worker's would, its stack traces read back
// through the bundle's source map onto the files as written.

const BROWSERS = ['chromium', 'firefox', 'webkit'];
const FILE_TIMEOUT_MS = 5 * 60_000;

// vitest's browser options: name (v2), or instances (v3), and the provider's.
function browserOptions(config) {
  const browser = config.browser ?? {};
  const name = browser.instances?.[0]?.browser ?? browser.name ?? 'chromium';
  if (!BROWSERS.includes(name)) {
    throw new Error(`browser ${name}: browser mode runs chromium, firefox or webkit`);
  }
  if (browser.provider && browser.provider !== 'playwright' && browser.provider !== 'preview') {
    throw new Error(`browser.provider ${browser.provider}: vyntra runs browser mode on Playwright`);
  }
  return {
    name,
    headless: browser.headless ?? true,
    viewport: browser.viewport ?? { width: 414, height: 896 },
    launch: browser.instances?.[0]?.launch ?? browser.providerOptions?.launch ?? {},
  };
}

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

// Frames of the bundle, at the files and lines they came from.
function mapStack(stack, url, map, rootDir) {
  if (!stack || !map) {
    return stack;
  }
  return stack
    .split('\n')
    .map((line) => {
      const at = line.lastIndexOf(url);
      const match = at === -1 ? null : /^:(\d+):(\d+)/.exec(line.slice(at + url.length));
      if (!match) {
        return line;
      }
      const entry = map.findEntry(Number(match[1]) - 1, Number(match[2]) - 1);
      if (entry.originalSource === undefined) {
        return line;
      }
      const source = entry.originalSource.startsWith('file:')
        ? new URL(entry.originalSource).pathname
        : path.resolve(rootDir, entry.originalSource);
      return `${line.slice(0, at)}${source}:${entry.originalLine + 1}:${entry.originalColumn + 1}${line.slice(at + url.length + match[0].length)}`;
    })
    .join('\n');
}

function mapErrors(errors, url, map, rootDir) {
  return (errors ?? []).map((error) => ({
    ...error,
    stack: mapStack(error.stack, url, map, rootDir),
    ...(error.cause ? { cause: mapErrors([error.cause], url, map, rootDir)[0] } : {}),
  }));
}

class BrowserRunner {
  constructor({ config, size, onResult }) {
    this.config = config;
    this.size = Math.max(1, size);
    this.onResult = onResult;
    this.queue = [];
    this.stopped = false;
    this.pages = new Map();
    this.contexts = new Set();
    this.coverage = [];
  }

  async serve() {
    this.server = http.createServer((request, response) => {
      const page = this.pages.get(request.url.split('?')[0]);
      if (!page) {
        response.writeHead(404);
        response.end();
        return;
      }
      response.writeHead(200, { 'content-type': page.type });
      response.end(page.body);
    });
    await new Promise((resolve) => {
      this.server.listen(0, '127.0.0.1', resolve);
    });
    this.origin = `http://127.0.0.1:${this.server.address().port}`;
  }

  async runFile(file, id) {
    const start = performance.now();
    const { rootDir } = this.config;
    let bundle;
    try {
      bundle = await bundleTestFile(file, this.config);
    } catch (error) {
      return this.failure(file, error, start);
    }
    const script = `/__vyntra/${id}.js`;
    const url = `${this.origin}${script}`;
    this.pages.set(script, { type: 'text/javascript', body: bundle.code });
    this.pages.set(`/__vyntra/${id}.html`, {
      type: 'text/html',
      body: `<!doctype html><html><head><meta charset="utf-8"><title>vyntra</title></head><body><script type="module" src="${script}"></script></body></html>`,
    });
    const map = bundle.map ? new SourceMap(JSON.parse(bundle.map)) : null;
    const context = await this.browser.newContext({ viewport: this.options.viewport });
    this.contexts.add(context);
    try {
      const page = await context.newPage();
      // V8's, as in Node: Chromium's alone gives it.
      const coverage = this.config.coverage && page.coverage;
      if (coverage) {
        await coverage.startJSCoverage({ resetOnNavigation: false });
      }
      const reported = Promise.withResolvers();
      await page.exposeFunction('__vyntraReport', (result) => reported.resolve(result));
      await page.exposeFunction('__vyntraCommand', commandsFor(page, { rootDir, file }));
      page.on('pageerror', (error) => reported.reject(error));
      await page.goto(`${this.origin}/__vyntra/${id}.html`);
      const timer = setTimeout(
        () => reported.reject(new Error(`The page did not report within ${FILE_TIMEOUT_MS / 1000}s`)),
        FILE_TIMEOUT_MS
      );
      let result;
      try {
        result = await reported.promise;
      } finally {
        clearTimeout(timer);
      }
      // eslint-disable-next-line global-require -- vyntra's internals, by path
      const host = require(coreFiles(rootDir).host);
      if (coverage) {
        const ran = (await coverage.stopJSCoverage()).find((entry) => entry.url === url);
        if (ran) {
          this.coverage.push(host.pageCoverage(bundle, ran.functions, this.config, this.files));
        }
      }
      const mapped = {
        ...result,
        path: file,
        errors: mapErrors(result.errors, url, map, rootDir),
        // Console output with stack traces in it (React's warnings) too.
        console: result.console.map((entry) => ({ ...entry, text: mapStack(entry.text, url, map, rootDir) })),
        tests: result.tests.map((test) => ({ ...test, errors: mapErrors(test.errors, url, map, rootDir) })),
      };
      return host.saveSnapshots(mapped, this.config, (stack) => mapStack(stack, url, map, rootDir));
    } catch (error) {
      return this.failure(file, error, start);
    } finally {
      this.contexts.delete(context);
      await context.close().catch(() => {});
      this.pages.delete(script);
      this.pages.delete(`/__vyntra/${id}.html`);
    }
  }

  // eslint-disable-next-line class-methods-use-this -- part of the runner's interface
  failure(file, error, start) {
    return {
      path: file,
      shard: null,
      duration: performance.now() - start,
      tests: [],
      errors: [
        {
          name: error.name ?? 'Error',
          message: String(error.message ?? error),
          stack: error.stack ?? '',
          phase: 'collect',
        },
      ],
      console: [],
      snapshot: null,
    };
  }

  async run(jobs) {
    this.options = browserOptions(this.config);
    this.queue = jobs.map((job) => job.path);
    this.files = [...this.queue];
    await this.serve();
    this.browser = await playwrightOf(this.config.rootDir)[this.options.name].launch({
      headless: this.options.headless,
      ...this.options.launch,
    });
    let next = 0;
    const lane = async () => {
      while (!this.stopped && this.queue.length > 0) {
        const file = this.queue.shift();
        next += 1;
        // eslint-disable-next-line no-await-in-loop -- a lane runs its files one after the other
        this.onResult(await this.runFile(file, next));
      }
    };
    try {
      await Promise.all(Array.from({ length: Math.min(this.size, jobs.length) }, lane));
    } finally {
      await this.browser.close().catch(() => {});
      this.server.close();
    }
    if (this.config.coverage && this.options.name !== 'chromium') {
      process.stderr.write(`Coverage in browser mode is Chromium's: ${this.options.name} gives none\n`);
    }
    // As a Node worker's: merged with theirs by the run.
    return this.coverage.map((coverage) => ({ coverage }));
  }

  stop() {
    this.stopped = true;
    this.queue = [];
  }

  interrupt() {
    this.stop();
    this.contexts.forEach((context) => context.close().catch(() => {}));
    this.browser?.close().catch(() => {});
  }
}

module.exports = { BrowserRunner };
