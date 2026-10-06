const os = require('node:os');
const { serializeError } = require('../run/serialize-error');
const { plan } = require('./schedule');
const { ShardMerger } = require('./shard-merger');
const { WorkerPool } = require('./worker-pool');
const { InlineRunner } = require('./inline-runner');
const { runGlobalSetup, runGlobalTeardown } = require('./global-setup');
const { TestServer } = require('./server');

const SERVER_LINES = 50;

// The config crosses to the workers by structured clone: no functions. Plugins hold functions too: each worker
// loads them from the config file.
const forWorkers = (config) =>
  Object.fromEntries(Object.entries(config).filter(([key, value]) => typeof value !== 'function' && key !== 'plugins'));

const failing = (result) => result.errors.length > 0 || result.tests.some((test) => test.status === 'failed');

// A problem outside the test files (a globalSetup that throws, a server that never answers), reported as the result
// of the file it comes from, so every reporter shows it. phase: 'setup' or 'environment' (exit codes 2 and 3), or
// none for a teardown that failed after the tests.
const problemResult = (file, project, error, phase) => ({
  path: file,
  project,
  synthetic: true,
  duration: 0,
  tests: [],
  errors: [{ ...serializeError(error), ...(phase ? { phase } : {}) }],
  console: [],
});

// Runs the projects of a run: the run's own globalSetup around them all; each project when the projects it depends
// on passed (skipped when one failed), with its globalSetup, its own worker pool, and its globalTeardown. Projects
// that can run together do, sharing the workers in proportion to their work.
class ProjectRun {
  // shared: what every worker of every project gets (the test files, the caches); explicitWorkers: the top-level
  // maxWorkers, as a number, if one was given.
  constructor({ run, projects, timings, shared, onFileResult, onNotice, explicitWorkers }) {
    this.hooks = run;
    this.projects = projects;
    this.timings = timings;
    this.shared = shared;
    this.onFileResult = onFileResult;
    this.onNotice = onNotice;
    this.single = projects.length === 1;
    this.cap = explicitWorkers ?? Math.max(1, os.availableParallelism() - 1);
    this.active = new Set();
    this.collected = [];
    this.stopped = false;
    this.provided = {};
    this.servers = new Set();
    this.serverInfo = null;
  }

  // How the run goes, for the header: { workers, inline }.
  layout() {
    if (!this.single) {
      const files = this.projects.reduce((sum, project) => sum + project.files.length, 0);
      return { workers: Math.min(this.cap, files), inline: false };
    }
    const planned = this.singlePlan();
    const inline = !planned || planned.jobs.length === 1;
    return { workers: inline ? 1 : planned.workers, inline };
  }

  // A run of one project plans as vyntra always did: from the timings, within the machine.
  singlePlan() {
    if (this.planned === undefined) {
      const { config, files } = this.projects[0];
      this.planned = config.pool === 'inline' ? null : plan(files, this.timings, config);
    }
    return this.planned;
  }

  problem(file, project, error, phase) {
    this.onFileResult(problemResult(file ?? this.shared.configFile ?? this.shared.rootDir, project, error, phase));
  }

  // globalSetup files, with the problem reported against the file that threw. Returns the teardowns, or null.
  async setUp(hooks, project, config) {
    try {
      return await runGlobalSetup(hooks.globalSetup, { config, name: project });
    } catch (error) {
      this.problem(error.setupFile, project, error.original ?? error, 'setup');
      return null;
    }
  }

  // The server of the run or of a project, started: the server, undefined when there is none, or null when it did
  // not start (reported as a problem of the environment).
  async startServer(hooks, project) {
    if (!hooks.server) {
      return undefined;
    }
    let server;
    try {
      server = new TestServer(hooks.server, { rootDir: this.shared.rootDir, name: project });
      this.servers.add(server);
      await server.start();
      return server;
    } catch (error) {
      this.servers.delete(server);
      this.problem(null, project, error, 'environment');
      return null;
    }
  }

  async stopServer(server) {
    if (server) {
      await server.stop();
      this.servers.delete(server);
    }
  }

  async tearDown(hooks, project, teardowns) {
    const errors = await runGlobalTeardown(hooks.globalTeardown, teardowns);
    errors.forEach((error) => this.problem(hooks.globalTeardown[0] ?? hooks.globalSetup[0], project, error));
    return errors.length === 0;
  }

  async run() {
    const setup = await this.setUp(this.hooks, null, {});
    if (!setup) {
      return this.collected;
    }
    this.provided = setup.provided;
    const server = await this.startServer(this.hooks, null);
    if (server !== null) {
      this.server = server;
      this.serverInfo = server?.info() ?? null;
      try {
        await this.runProjects();
      } finally {
        await this.stopServer(server);
      }
    }
    await this.tearDown(this.hooks, null, setup.teardowns);
    return this.collected;
  }

  async runProjects() {
    const names = new Set(this.projects.map((project) => project.name));
    const status = new Map();
    const pending = [...this.projects];
    const running = new Map();
    // runInBand: one project after the other, each in the main thread's worker of one.
    const oneAtATime = !this.single && this.projects.some((project) => project.config.pool === 'inline');
    this.inUse = 0;
    while (pending.length > 0 || running.size > 0) {
      const ready = this.settle(pending, status, names);
      const startable = oneAtATime ? ready.slice(0, running.size === 0 ? 1 : 0) : ready;
      const shares = this.shares(startable, this.cap - this.inUse);
      startable.forEach((project, i) => {
        pending.splice(pending.indexOf(project), 1);
        this.inUse += shares[i];
        const done = this.runProject(project, shares[i]).then((passed) => {
          status.set(project.name, passed ? 'passed' : 'failed');
          this.inUse -= shares[i];
          running.delete(project.name);
        });
        running.set(project.name, done);
      });
      if (running.size === 0) {
        break;
      }
      // eslint-disable-next-line no-await-in-loop -- the next projects start when one ends
      await Promise.race(running.values());
    }
  }

  // Takes the projects that can not run (one they depend on did not pass, or the run stopped) out of pending, as
  // skipped, until none is left to take: a skipped project skips those that depend on it. Returns those that can
  // start: every project they depend on passed.
  settle(pending, status, names) {
    let changed = true;
    while (changed) {
      changed = false;
      for (let i = 0; i < pending.length; i += 1) {
        const project = pending[i];
        const blocked = project.dependsOn
          .filter((dep) => names.has(dep))
          .find((dep) => status.get(dep) === 'failed' || status.get(dep) === 'skipped');
        if (blocked || this.stopped) {
          pending.splice(i, 1);
          status.set(project.name, 'skipped');
          if (blocked) {
            this.onNotice(`Project ${project.name} skipped: ${blocked} did not pass`);
          }
          changed = true;
          break;
        }
      }
    }
    return pending.filter((project) =>
      project.dependsOn.filter((dep) => names.has(dep)).every((dep) => status.get(dep) === 'passed')
    );
  }

  // Workers for projects starting together: the free ones, in proportion to the work of each (its files' recorded
  // durations, or their number), at least one each.
  shares(projects, free) {
    if (projects.length === 0) {
      return [];
    }
    const work = projects.map(
      (project) =>
        project.files.reduce((sum, file) => sum + (this.timings.duration(file) ?? 1000), 0) || project.files.length
    );
    const total = work.reduce((sum, value) => sum + value, 0) || 1;
    const available = Math.max(projects.length, free);
    return work.map((value) => Math.max(1, Math.floor((available * value) / total)));
  }

  // Runs one project; resolves with whether it passed.
  async runProject(project, share) {
    const { name, files } = project;
    if (files.length === 0) {
      return true;
    }
    const config = { ...project.config, ...this.shared, provided: { ...this.provided } };
    const setup = await this.setUp(project, name, config);
    if (!setup) {
      return false;
    }
    Object.assign(config.provided, setup.provided);
    const own = await this.startServer(project, name);
    if (own === null) {
      await this.tearDown(project, name, setup.teardowns);
      return false;
    }
    const server = own ?? this.server;
    config.serverInfo = server?.info() ?? null;
    let passed = true;
    const merger = new ShardMerger((result) => {
      if (name) {
        Object.assign(result, { project: name });
      }
      // What the server printed until then: the other half of a failing API test.
      if (server && failing(result)) {
        Object.assign(result, { serverOutput: server.output(SERVER_LINES) });
      }
      passed &&= !failing(result);
      this.onFileResult(result);
    });
    const runner = this.runnerFor(config, files, share, (result) => merger.add(result));
    this.active.add(runner.runner);
    try {
      this.collected.push(...(await runner.runner.run(runner.jobs)));
    } finally {
      this.active.delete(runner.runner);
      merger.flush();
      await this.stopServer(own);
    }
    const tornDown = await this.tearDown(project, name, setup.teardowns);
    return passed && tornDown;
  }

  // A pool of workers for the project's files, or the main thread for a run of one project whose files make one job.
  runnerFor(config, files, share, onResult) {
    const { single } = this;
    const own = config.maxWorkers;
    const pool = !single && config.pool === 'inline' ? 'threads' : config.pool;
    const limited = { ...config, pool, maxWorkers: Math.min(share, typeof own === 'number' ? own : share) };
    const planned = single ? this.singlePlan() : plan(files, this.timings, limited);
    // One job (a file run whole) runs in the main thread: no worker to start. A single long file split in parts does
    // get workers. In the main thread, split files would only run one part after the other: they run whole.
    if (single && (!planned || planned.jobs.length === 1)) {
      return {
        runner: new InlineRunner({ config, onResult }),
        jobs: files.map((file) => ({ path: file, shard: null })),
      };
    }
    const runner = new WorkerPool({ size: planned.workers, config: forWorkers({ ...config, pool }), onResult });
    return { runner, jobs: planned.jobs };
  }

  // Skips the files not started yet, and the projects not started.
  stop() {
    this.stopped = true;
    this.active.forEach((runner) => runner.stop());
  }

  interrupt() {
    this.stopped = true;
    this.servers.forEach((server) => server.kill());
    this.active.forEach((runner) => (runner.interrupt ?? runner.stop).call(runner));
  }
}

module.exports = { ProjectRun };
