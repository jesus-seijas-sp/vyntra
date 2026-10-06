const path = require('node:path');
const Module = require('node:module');

// Live sessions on the app a project tests, for coding agents (and their subagents) that look at it before writing
// a test: each session is a browser context of its own on the project's baseURL, after the servers its tests need
// are up. Servers are started as a run starts them, shared by the sessions that need the same one, and stopped when
// the last of them closes.

function playwrightOf(rootDir) {
  try {
    return Module.createRequire(path.join(rootDir, 'package.json'))('playwright');
  } catch {
    try {
      // eslint-disable-next-line global-require -- the one installed with this server, an optional peer
      return require('playwright');
    } catch {
      throw new Error('Live sessions need Playwright in the project: npm install --save-dev playwright');
    }
  }
}

function toolingOf(rootDir) {
  try {
    return Module.createRequire(path.join(rootDir, 'package.json'))('vyntra/tooling');
  } catch {
    // eslint-disable-next-line global-require -- the vyntra installed with this server
    return require('vyntra/tooling');
  }
}

class Sessions {
  constructor({ rootDir, max = 4 }) {
    this.rootDir = rootDir;
    this.max = max;
    this.open = new Map();
    this.browsers = new Map();
    // Started servers, by command and url: { server, users }.
    this.servers = new Map();
    this.count = 0;
  }

  // The session asked for; with none asked for, the only one open.
  get(id) {
    if (id) {
      const session = this.open.get(id);
      if (!session) {
        throw new Error(`There is no session ${id}${this.list()}`);
      }
      return session;
    }
    if (this.open.size === 1) {
      return [...this.open.values()][0];
    }
    throw new Error(
      this.open.size === 0 ? 'No session is open: open_session first' : `Say which session${this.list()}`
    );
  }

  list() {
    return this.open.size > 0 ? `. Open: ${[...this.open.keys()].join(', ')}` : '';
  }

  async browser(headed) {
    const key = headed ? 'headed' : 'headless';
    if (!this.browsers.has(key)) {
      this.browsers.set(key, playwrightOf(this.rootDir).chromium.launch({ headless: !headed }));
    }
    return this.browsers.get(key);
  }

  async startServer(tooling, options, name) {
    const key = JSON.stringify([options.command, options.url ?? options.port]);
    if (!this.servers.has(key)) {
      const server = new tooling.TestServer(options, { rootDir: this.rootDir, name });
      const started = server.start().then(() => server);
      this.servers.set(key, { started, users: 0 });
      started.catch(() => this.servers.delete(key));
    }
    const entry = this.servers.get(key);
    const server = await entry.started;
    entry.users += 1;
    return { key, server };
  }

  async release(keys) {
    await Promise.all(
      keys.map(async (key) => {
        const entry = this.servers.get(key);
        if (!entry) {
          return;
        }
        entry.users -= 1;
        if (entry.users <= 0) {
          this.servers.delete(key);
          await (await entry.started).stop();
        }
      })
    );
  }

  // Opens a session: { id, page, project, url }. url: where to start (a path of the app, or a full URL); project:
  // the project of the config whose servers and baseURL to use (by default the first with the web engine).
  async start({ project: wanted, url, headed = false } = {}) {
    if (this.open.size >= this.max) {
      throw new Error(
        `${this.open.size} sessions are open, the most this server allows (--max-sessions)${this.list()}`
      );
    }
    const tooling = toolingOf(this.rootDir);
    const project = await tooling.loadProject(this.rootDir, wanted);
    const keys = [];
    let serverUrl = null;
    try {
      // One after the other, as a run starts them: the project's server may need the run's.
      for (let i = 0; i < project.servers.length; i += 1) {
        // eslint-disable-next-line no-await-in-loop
        const { key, server } = await this.startServer(tooling, project.servers[i], project.name);
        keys.push(key);
        serverUrl = server.url;
      }
      const baseURL = project.config.use?.baseURL ?? (serverUrl ? new URL(serverUrl).origin : undefined);
      const browser = await this.browser(headed);
      const context = await browser.newContext({
        baseURL,
        ...(project.config.use?.viewport ? { viewport: project.config.use.viewport } : {}),
      });
      const page = await context.newPage();
      const start = url ?? (baseURL ? '/' : null);
      if (start) {
        await page.goto(start, { timeout: 30_000 });
      }
      this.count += 1;
      const session = { id: `s${this.count}`, page, context, keys, project: project.name, baseURL };
      this.open.set(session.id, session);
      return session;
    } catch (error) {
      await this.release(keys);
      throw error;
    }
  }

  async close(id) {
    const session = this.get(id);
    this.open.delete(session.id);
    await session.context.close().catch(() => {});
    await this.release(session.keys);
    return session;
  }

  async closeAll() {
    await Promise.all([...this.open.keys()].map((id) => this.close(id)));
    await Promise.all([...this.browsers.values()].map(async (browser) => (await browser).close()));
    this.browsers.clear();
  }
}

module.exports = { Sessions };
