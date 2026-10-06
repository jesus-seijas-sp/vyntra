const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { version } = require('../../package.json');
const { colors: c, setColors, detectColors } = require('../colors');
const { mergeCoverage } = require('../coverage/collector');
const { reportCoverage } = require('../coverage/report');
const { ResolveCache, dependencyStamp, cacheFile } = require('../resolve-cache');
const { realTimers } = require('../timers');
const { parseCli } = require('./args');
const { loadConfig } = require('./config');
const { parseShard, selectShard } = require('./select-shard');
const { EXIT, brokeSetup } = require('./exit-codes');
const { readReport, owedAfter, rerunOf, writeReport } = require('./last-run');
const { reporterNames, unknownReporters, createReporters, clearOutputs } = require('./reporters');
const { explicitWorkers } = require('./schedule');
const { Timings } = require('./timings');
const { resolveProjects, assignFiles } = require('./projects');
const { ProjectRun } = require('./run-projects');

// Caches that make loading the dependencies faster, kept in node_modules/.cache (only for projects with node_modules).
function loadingCaches(rootDir) {
  if (!fs.existsSync(path.join(rootDir, 'node_modules'))) {
    return {};
  }
  return {
    resolveCache: { file: cacheFile(rootDir), stamp: dependencyStamp(rootDir) },
    transformCacheDir: path.join(rootDir, 'node_modules', '.cache', 'vyntra', 'compiled'),
  };
}

// Node settles the default locale of Intl as the process starts. A config that sets one (vitest
// configs set LC_ALL so dates format the same on every machine) is only heard by a process started
// after it, so vyntra starts again with it, once. TZ needs nothing: Node reads it whenever it changes.
const LOCALE_VARIABLES = [
  'LC_ALL',
  'LC_TIME',
  'LC_NUMERIC',
  'LC_MONETARY',
  'LC_COLLATE',
  'LC_CTYPE',
  'LC_MESSAGES',
  'LANG',
];
const startLocale = LOCALE_VARIABLES.map((name) => process.env[name]);
const RELAUNCHED = 'VYNTRA_LOCALE_RELAUNCHED';

function localeChanged() {
  return !process.env[RELAUNCHED] && LOCALE_VARIABLES.some((name, i) => process.env[name] !== startLocale[i]);
}

function relaunch(argv) {
  const { status, signal } = spawnSync(process.execPath, [...process.execArgv, process.argv[1], ...argv], {
    stdio: 'inherit',
    env: { ...process.env, [RELAUNCHED]: '1' },
  });
  if (signal) {
    return signal === 'SIGINT' ? EXIT.interrupted : EXIT.failed;
  }
  return status ?? EXIT.failed;
}

const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`;

// "3 tests", "2 tests, 1 file": what --last-failed reruns, as the header shows it (a file that did not load runs whole).
function describeRerun(selections) {
  const whole = selections.filter((tests) => tests === null).length;
  const tests = selections.reduce((sum, item) => sum + (item?.length ?? 0), 0);
  return [tests > 0 && plural(tests, 'test'), whole > 0 && plural(whole, 'file')].filter(Boolean).join(', ');
}

async function main(argv = process.argv.slice(2)) {
  const start = realTimers.performanceNow();
  const cli = parseCli(argv);
  if (cli.help) {
    process.stdout.write(cli.usage);
    return 0;
  }
  if (cli.version) {
    process.stdout.write(`${version}\n`);
    return 0;
  }
  if (cli.watch) {
    process.stderr.write(`${c.yellow('Watch mode is not available yet: running once.')}
`);
  }
  let config;
  try {
    config = await loadConfig(cli.options);
  } catch (error) {
    process.stderr.write(`${c.red('Could not load the config')}\n${error.stack ?? error}\n`);
    return EXIT.setup;
  }
  if (localeChanged()) {
    return relaunch(argv);
  }
  config.colors ??= detectColors();
  setColors(config.colors);
  const timings = new Timings(config.rootDir);
  let shard = null;
  try {
    shard = config.shard ? parseShard(config.shard) : null;
  } catch (error) {
    process.stderr.write(`${c.red(error.message)}\n`);
    return EXIT.setup;
  }
  const reporters = reporterNames(config.reporter);
  const unknown = unknownReporters(reporters);
  if (unknown.length > 0) {
    process.stderr.write(
      `${c.red(`Unknown reporter: ${unknown.join(', ')}`)} (default, verbose, json, junit, markdown, github)\n`
    );
    return EXIT.setup;
  }
  let resolved;
  try {
    resolved = resolveProjects(config, cli.projects);
  } catch (error) {
    process.stderr.write(`${c.red(error.message)}\n`);
    return EXIT.setup;
  }
  const startedAt = new Date().toISOString();
  const previous = readReport(config);
  let projects = assignFiles(resolved.projects, cli.patterns).filter(
    (project) => !resolved.selected || resolved.selected.has(project.name)
  );
  let discovered = projects.flatMap((project) => project.files);
  let rerunning = null;
  const keep = (wanted) => {
    projects = projects.map((project) => ({ ...project, files: project.files.filter((file) => wanted.has(file)) }));
  };
  if (config.lastFailed && !previous) {
    process.stdout.write(`${c.yellow('No report of an earlier run: running every test')}\n`);
  } else if (config.lastFailed) {
    const rerun = rerunOf(previous, config.rootDir);
    discovered = discovered.filter((file) => file in rerun);
    if (discovered.length === 0) {
      process.stdout.write(`${c.green('No failed tests to rerun')}\n`);
      return EXIT.passed;
    }
    keep(new Set(discovered));
    projects.forEach((project) => Object.assign(project.config, { rerun }));
    rerunning = describeRerun(discovered.map((file) => rerun[file]));
  }
  if (shard) {
    keep(new Set(selectShard(discovered, shard, config.rootDir)));
  }
  projects = projects.map((project) => ({ ...project, files: timings.sort(project.files) }));
  const files = projects.flatMap((project) => project.files);
  if (files.length === 0) {
    const where = shard ? ` in shard ${shard.index}/${shard.total} (of ${discovered.length})` : '';
    process.stdout.write(`${c.yellow(`No test files found${where}`)}\n`);
    return config.passWithNoTests ? EXIT.passed : EXIT.setup;
  }
  // Coverage leaves out the test files themselves. V8 keys its code cache by module URL, and each test file imports
  // the project's modules under URLs of its own: the cache grows by a copy per file and run and is rarely read back.
  // Measured slower than compiling, so it is only kept for configs that ask (compileCache: true).
  const shared = { testFiles: files, ...loadingCaches(config.rootDir) };
  if (config.compileCache === true) {
    shared.compileCacheDir = path.join(config.rootDir, 'node_modules', '.cache', 'vyntra', 'v8');
  }
  let failedFiles = 0;
  let brokenFiles = 0;
  let environmentFiles = 0;
  let run;
  const results = [];
  let reporter;
  const onFileResult = (result) => {
    results.push(result);
    if (!result.synthetic) {
      const work = result.work ?? result.duration;
      const testTime = result.tests.reduce((sum, test) => sum + test.duration, 0);
      timings.record(result.path, work, result.tests.length, Math.max(0, work - testTime) / (result.shards ?? 1));
    }
    reporter.onFileResult(result);
    if (result.errors.some((error) => error.phase === 'environment')) {
      environmentFiles += 1;
    } else if (brokeSetup(result)) {
      brokenFiles += 1;
    }
    if (result.errors.length > 0 || result.tests.some((test) => test.status === 'failed')) {
      failedFiles += 1;
      // --bail n: no more files once n have failed.
      if (config.bail > 0 && failedFiles >= config.bail) {
        run.stop();
      }
    }
  };
  const named = projects.filter((project) => project.name);
  run = new ProjectRun({
    run: resolved.run,
    projects,
    timings,
    shared: { ...shared, configFile: config.configFile, rootDir: config.rootDir },
    onFileResult,
    onNotice: (text) => process.stdout.write(`${c.yellow(text)}\n`),
    explicitWorkers:
      config.maxWorkers !== undefined ? explicitWorkers(config.maxWorkers, os.availableParallelism()) : undefined,
  });
  const layout = run.layout();
  reporter = createReporters(reporters, {
    ...config,
    pool: layout.inline ? 'inline' : config.pool,
    shard,
    rerunning,
    projectNames: named.length > 0 ? named.map((project) => project.name) : null,
  });
  if (!config.lastFailed) {
    clearOutputs(config);
  }
  reporter.onStart(files.length, layout.workers);
  const onInterrupt = () => {
    run.interrupt();
    process.stdout.write(`\n${c.yellow('Interrupted')}\n`, () => process.exit(EXIT.interrupted));
  };
  process.once('SIGINT', onInterrupt);
  const collected = await run.run();
  process.off('SIGINT', onInterrupt);
  timings.save();
  if (shared.resolveCache) {
    ResolveCache.save(
      shared.resolveCache,
      collected.map((item) => item.resolutions)
    );
  }
  const duration = realTimers.performanceNow() - start;
  const passed = reporter.onFinish(duration);
  const coverage = collected.map((item) => item.coverage).filter(Boolean);
  const covered = config.coverage ? reportCoverage(mergeCoverage(coverage), { ...config, testFiles: files }) : true;
  // Fixtures shared by a worker end with it, after its files: their teardown errors belong to no file.
  const teardownErrors = collected.flatMap((item) => item?.errors ?? []);
  teardownErrors.forEach((error) => {
    process.stderr.write(`${c.red('A worker fixture failed to tear down:')}\n${error.stack || error.message}\n`);
  });
  let exitCode = passed && covered && failedFiles === 0 && teardownErrors.length === 0 ? EXIT.passed : EXIT.failed;
  if (environmentFiles > 0) {
    exitCode = EXIT.environment;
  } else if (brokenFiles > 0) {
    exitCode = EXIT.setup;
  }
  const owed = owedAfter(
    previous?.owed ?? [],
    results.filter((result) => !result.synthetic),
    config.rootDir
  );
  writeReport(config, { startedAt, duration, exitCode, results, owed });
  return exitCode;
}

module.exports = { main };
