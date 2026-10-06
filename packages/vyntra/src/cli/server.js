const { spawn, spawnSync } = require('node:child_process');

const DEFAULT_TIMEOUT = 60_000;
const POLL_MS = 100;
const STOP_MS = 5_000;
const KEPT_LINES = 200;

// What counts as up, as in Playwright: the server answers, and not with an error of its own.
const answered = (status) => (status >= 200 && status < 400) || (status >= 400 && status <= 403);

async function answers(url) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(1_000), redirect: 'manual' });
    await response.body?.cancel();
    return answered(response.status);
  } catch {
    return false;
  }
}

const delay = (ms) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

// The `server` option of a project (or of the run): a command started before its tests, polled at `url` (or
// http://localhost:<port>) until it answers, and stopped after them. reuseExisting attaches to one already running.
// Its output is kept, for the errors and failure pages of its tests.
class TestServer {
  constructor(options, { rootDir, name }) {
    if (!options.command && !options.reuseExisting) {
      throw new Error('A server needs a command to start it');
    }
    if (!options.url && !options.port) {
      throw new Error('A server needs a url (or a port) to know when it is up');
    }
    this.options = options;
    this.rootDir = rootDir;
    this.name = name;
    this.url = options.url ?? `http://localhost:${options.port}`;
    this.lines = [];
    this.child = null;
    this.exited = null;
  }

  // The last lines it printed.
  output(count = 50) {
    return this.lines.slice(-count).join('\n');
  }

  keep(chunk) {
    const text = (this.partial ?? '') + chunk.toString();
    const lines = text.split(/\r?\n/);
    this.partial = lines.pop();
    this.lines.push(...lines);
    if (this.lines.length > KEPT_LINES) {
      this.lines.splice(0, this.lines.length - KEPT_LINES);
    }
  }

  // What the tests get as the `server` fixture.
  info() {
    return { url: this.url, name: this.name, reused: this.reused };
  }

  fail(message) {
    const output = this.output();
    const error = new Error(`${message}${output ? `\n\nIts output:\n${output}` : ''}`);
    error.name = 'ServerError';
    return error;
  }

  async start() {
    const { command, timeout = DEFAULT_TIMEOUT, reuseExisting, env, cwd } = this.options;
    if (await answers(this.url)) {
      if (reuseExisting) {
        this.reused = true;
        return;
      }
      throw this.fail(`Something already answers at ${this.url}: stop it, or set reuseExisting to use it`);
    }
    if (!command) {
      throw this.fail(`No server answers at ${this.url}, and there is no command to start one`);
    }
    this.reused = false;
    // Its own process group, so stopping it stops what it started (npm run, a shell).
    this.child = spawn(command, {
      shell: true,
      cwd: cwd ?? this.rootDir,
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: process.platform !== 'win32',
    });
    this.child.stdout.on('data', (chunk) => this.keep(chunk));
    this.child.stderr.on('data', (chunk) => this.keep(chunk));
    this.exited = new Promise((resolve) => {
      this.child.once('exit', (code, signal) => resolve({ code, signal }));
      this.child.once('error', (error) => resolve({ error }));
    });
    const deadline = Date.now() + timeout;
    let ended = null;
    this.exited.then((outcome) => {
      ended = outcome;
    });
    while (Date.now() < deadline) {
      if (ended) {
        const how = ended.error ? ended.error.message : `exited with code ${ended.code ?? ended.signal}`;
        throw this.fail(`The server command "${command}" ${how} before ${this.url} answered`);
      }
      // eslint-disable-next-line no-await-in-loop -- polled until it answers
      if (await answers(this.url)) {
        return;
      }
      // eslint-disable-next-line no-await-in-loop
      await delay(POLL_MS);
    }
    await this.stop();
    throw this.fail(`The server did not answer at ${this.url} within ${timeout}ms of starting "${command}"`);
  }

  signal(name) {
    if (!this.child || this.child.exitCode !== null || this.child.signalCode !== null) {
      return;
    }
    try {
      if (process.platform === 'win32') {
        // The child is the shell: killing it alone would leave the server it started running. taskkill ends the
        // tree, and is always forced (Windows has no SIGTERM for console programs).
        spawnSync('taskkill', ['/pid', String(this.child.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
      } else {
        process.kill(-this.child.pid, name);
      }
    } catch {
      // Gone already.
    }
  }

  // Stops what it started (nothing, when it attached to a running server): asked first, then forced.
  async stop() {
    if (!this.child) {
      return;
    }
    this.signal('SIGTERM');
    const stopped = await Promise.race([this.exited, delay(STOP_MS).then(() => null)]);
    if (!stopped) {
      this.signal('SIGKILL');
      await this.exited;
    }
    this.child = null;
  }

  // On Ctrl+C, with no time to wait.
  kill() {
    this.signal('SIGKILL');
  }
}

module.exports = { TestServer, answers };
