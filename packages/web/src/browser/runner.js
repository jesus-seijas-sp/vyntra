const http = require('node:http');
const { SourceMap } = require('node:module');
const path = require('node:path');
const { bundleTestFile, coreFiles } = require('./bundle');
const { PlaywrightProvider } = require('./providers/playwright');
const { WebdriverioProvider } = require('./providers/webdriverio');

// Vitest's browser mode: each test file runs in a real browser page, through Playwright or WebdriverIO. Its bundle
// (see bundle.js) is served from a local server (a page with an origin, as vitest's), several files at once; the
// page sends its result and its commands back to that server, and its stack traces are read back through the
// bundle's source map onto the files as written.

const FILE_TIMEOUT_MS = 5 * 60_000;
const PROVIDERS = { playwright: PlaywrightProvider, preview: PlaywrightProvider, webdriverio: WebdriverioProvider };
// The options of a vitest 3 instance that are vitest's, not the provider's.
const INSTANCE_KEYS = ['browser', 'name', 'headless', 'viewport', 'setupFiles', 'provide', 'testerHtmlPath'];

// vitest's browser options: name (v2), or instances (v3); the provider, a name or what its factory returned (v4),
// and its options, wherever the version put them.
function browserOptions(config) {
  const browser = config.browser ?? {};
  const { provider = 'playwright' } = browser;
  const providerName = typeof provider === 'string' ? provider : provider.name;
  if (!PROVIDERS[providerName]) {
    throw new Error(`browser.provider ${providerName}: vyntra runs browser mode on Playwright or WebdriverIO`);
  }
  const instance = browser.instances?.[0] ?? {};
  const instanceOptions = Object.fromEntries(Object.entries(instance).filter(([key]) => !INSTANCE_KEYS.includes(key)));
  return {
    provider: providerName,
    name: instance.browser ?? browser.name ?? (providerName === 'webdriverio' ? 'chrome' : 'chromium'),
    headless: instance.headless ?? browser.headless ?? true,
    explicitHeadless: (instance.headless ?? browser.headless) === true,
    viewport: instance.viewport ?? browser.viewport ?? { width: 414, height: 896 },
    providerOptions: {
      ...browser.providerOptions,
      ...instanceOptions,
      ...(typeof provider === 'object' ? provider.options : {}),
    },
  };
}

// The page of a test file: the bundle, and how it talks to the runner, by any provider: POSTs to its server.
function pageHtml(id, script) {
  const channel = `/__vyntra/${id}`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>vyntra</title>
<script>
(() => {
  const send = (kind, body) =>
    fetch(${JSON.stringify(channel)} + '/' + kind, { method: 'POST', body: JSON.stringify(body ?? null) })
      .then((response) => response.json())
      .then((answer) => {
        if (answer.error) {
          throw Object.assign(new Error(answer.error.message), { name: answer.error.name });
        }
        return answer.value;
      });
  globalThis.__vyntraReport = (result) => send('report', result);
  globalThis.__vyntraCommand = (name, args) => send('command', { name, args });
  // Until vyntra's runtime runs, an error is the bundle's: the file fails with it.
  const failed = (error) => {
    if (!globalThis[Symbol.for('vyntra.started')]) {
      send('error', { name: error?.name ?? 'Error', message: String(error?.message ?? error), stack: error?.stack ?? '' });
    }
  };
  globalThis.__vyntraFailed = failed;
  addEventListener('error', (event) => failed(event.error ?? new Error(event.message)));
  addEventListener('unhandledrejection', (event) => failed(event.reason));
})();
</script></head><body><script type="module" src="${script}" onerror="__vyntraFailed(new Error('The test bundle did not load'))"></script></body></html>`;
}

const readBody = (request) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    request.on('data', (chunk) => chunks.push(chunk));
    request.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || 'null'));
      } catch (error) {
        reject(error);
      }
    });
    request.on('error', reject);
  });

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
    // What each page's channel goes to: { report, command, error }, by the page's id.
    this.channels = new Map();
    this.coverage = [];
  }

  async serve() {
    this.server = http.createServer((request, response) => {
      const url = request.url.split('?')[0];
      if (request.method === 'POST') {
        this.answer(url, request, response);
        return;
      }
      const page = this.pages.get(url);
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

  // A page's POST to /__vyntra/<id>/<report|command|error>: the answer is { value } or { error }.
  async answer(url, request, response) {
    const [, id, kind] = /^\/__vyntra\/(\d+)\/(\w+)$/.exec(url) ?? [];
    const channel = this.channels.get(id)?.[kind];
    let answer;
    try {
      if (!channel) {
        throw new Error(`No page ${id} to take ${kind}`);
      }
      const body = await readBody(request);
      answer = { value: (await channel(body)) ?? null };
    } catch (error) {
      answer = { error: { name: error?.name ?? 'Error', message: String(error?.message ?? error) } };
    }
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify(answer));
  }

  async runFile(file, id, lane) {
    const start = performance.now();
    const { rootDir } = this.config;
    let bundle;
    try {
      bundle = await bundleTestFile(file, this.config);
    } catch (error) {
      return this.failure(file, error, start);
    }
    const script = `/__vyntra/${id}.js`;
    const html = `/__vyntra/${id}.html`;
    const url = `${this.origin}${script}`;
    this.pages.set(script, { type: 'text/javascript', body: bundle.code });
    this.pages.set(html, { type: 'text/html', body: pageHtml(id, script) });
    const map = bundle.map ? new SourceMap(JSON.parse(bundle.map)) : null;
    let page;
    try {
      page = await this.provider.open({ file, lane });
      const reported = Promise.withResolvers();
      this.channels.set(String(id), {
        report: (result) => reported.resolve(result),
        command: ({ name, args }) => page.command(name, args),
        error: (error) => reported.reject(Object.assign(new Error(error.message), error)),
      });
      const coverage = this.config.coverage && this.provider.coverage;
      if (coverage) {
        await page.startCoverage();
      }
      await page.goto(`${this.origin}${html}`);
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
        const ran = (await page.takeCoverage()).find((entry) => entry.url === url);
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
      return this.failure(
        file,
        { ...error, stack: mapStack(error.stack, url, map, rootDir), message: error.message, name: error.name },
        start
      );
    } finally {
      this.channels.delete(String(id));
      await page?.close();
      this.pages.delete(script);
      this.pages.delete(html);
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
    this.provider = new PROVIDERS[this.options.provider](this.options, { rootDir: this.config.rootDir });
    this.queue = jobs.map((job) => job.path);
    this.files = [...this.queue];
    await this.serve();
    let next = 0;
    const lane = async (_, index) => {
      while (!this.stopped && this.queue.length > 0) {
        const file = this.queue.shift();
        next += 1;
        // eslint-disable-next-line no-await-in-loop -- a lane runs its files one after the other
        this.onResult(await this.runFile(file, next, index));
      }
    };
    try {
      await this.provider.launch();
      await Promise.all(Array.from({ length: Math.min(this.size, jobs.length, this.provider.lanes) }, lane));
    } finally {
      await this.provider.close().catch(() => {});
      this.server.close();
    }
    if (this.config.coverage && !this.provider.coverage) {
      process.stderr.write(
        `Coverage in browser mode is Chromium's, on Playwright: ${this.options.provider} with ${this.options.name} gives none\n`
      );
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
    this.provider?.close().catch(() => {});
  }
}

module.exports = { BrowserRunner, browserOptions };
