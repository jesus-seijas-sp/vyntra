const { parseArgs } = require('node:util');

// Jest and vitest flag names are both accepted, so existing scripts keep working.
const OPTIONS = {
  config: { type: 'string', short: 'c' },
  root: { type: 'string', short: 'r' },
  testNamePattern: { type: 'string', short: 't' },
  silent: { type: 'boolean' },
  isolate: { type: 'boolean' },
  'no-isolate': { type: 'boolean' },
  pool: { type: 'string' },
  runInBand: { type: 'boolean', short: 'i' },
  maxWorkers: { type: 'string', short: 'w' },
  testTimeout: { type: 'string' },
  reporter: { type: 'string', multiple: true },
  verbose: { type: 'boolean' },
  bail: { type: 'string' },
  retry: { type: 'string' },
  allowOnly: { type: 'boolean' },
  passWithNoTests: { type: 'boolean' },
  update: { type: 'boolean', short: 'u' },
  color: { type: 'boolean' },
  'no-color': { type: 'boolean' },
  help: { type: 'boolean', short: 'h' },
  version: { type: 'boolean', short: 'v' },
  coverage: { type: 'boolean' },
  coverageDirectory: { type: 'string' },
  'coverage.reportsDirectory': { type: 'string' },
  splitFiles: { type: 'boolean' },
  shard: { type: 'string' },
  project: { type: 'string', multiple: true },
  bench: { type: 'boolean' },
  outputJson: { type: 'string' },
  compare: { type: 'string' },
  typecheck: { type: 'boolean' },
  'typecheck.only': { type: 'boolean' },
  'last-failed': { type: 'boolean' },
  'fail-on-flaky': { type: 'boolean' },
  failOnFlaky: { type: 'boolean' },
  lastFailed: { type: 'boolean' },
  outputDir: { type: 'string' },
  ci: { type: 'boolean' },
  watch: { type: 'boolean' },
  watchAll: { type: 'boolean' },
  ai: { type: 'string' },
  // Accepted for compatibility, nothing to do.
  run: { type: 'boolean' },
};

const USAGE = `Usage: vyntra [options] [path patterns...]
       vyntra watch [options]     Run the tests, then what each change touches (also --watch)
       vyntra bench [options]     Run the benchmarks (*.bench.*); --outputJson <file>, --compare <file>
       vyntra guide [topic]       Print the documentation (no topic: the list of topics)
       vyntra init --agents       Write the skill coding agents use to run and fix tests here

Options:
  -t, --testNamePattern <regex>  Run only the tests whose full name matches
  -c, --config <file>            Config file (default: vyntra.config.js, or the Vitest or Jest config)
  -r, --root <dir>               Project root (default: current directory)
  -w, --maxWorkers <n|n%>        Worker threads (default: cores - 1)
  -i, --runInBand                Run every file in the main thread
      --pool <threads|forks|inline>  Worker threads (default), child processes like Jest, or the main thread
      --no-isolate               Share project modules between files (faster, less isolated)
      --testTimeout <ms>         Default timeout of tests (default: 5000)
      --reporter <name>          default, verbose or json; and junit, markdown, github (repeat it, or use commas)
      --retry <n>                Retry failing tests
      --bail <n>                 Stop after n failed files
      --silent                   Do not print console output of tests
      --passWithNoTests          Do not fail when no test files are found
  -u, --update                   Update snapshots
      --coverage                 Report the coverage of the project files (V8)
      --coverageDirectory <dir>  Where coverage reports go (default: coverage; vitest's --coverage.reportsDirectory too)
      --splitFiles               Run long files in parts on several workers (their tests must be independent)
      --project <name>           Run only this project (repeat it, or use commas)
      --shard <index>/<total>    Run one slice of the test files, for CI jobs in parallel (e.g. --shard 2/4)
      --fail-on-flaky            Fail the run when a test passed only on a retry (also --failOnFlaky)
      --typecheck                Check the types of the *.test-d.ts files (--typecheck.only: and run nothing else)
      --last-failed              Run only the tests that failed, until they pass (also --lastFailed)
      --outputDir <dir>          Where the run's report goes (default: .vyntra)
      --ci                       Do not write new snapshots
      --ai <mode>                AI steps (@vyntra/ai): replay, record, live or off
  -h, --help                     Show this help
`;

const toNumber = (value) => (value === undefined ? undefined : Number(value));

// CLI arguments as config options (only the ones given) plus the positional patterns.
function parseCli(argv) {
  const { values, positionals } = parseArgs({ args: argv, options: OPTIONS, allowPositionals: true, strict: false });
  const options = {
    config: values.config,
    rootDir: values.root,
    testNamePattern: values.testNamePattern,
    silent: values.silent,
    pool: values.runInBand ? 'inline' : values.pool,
    maxWorkers: values.maxWorkers,
    testTimeout: toNumber(values.testTimeout),
    reporter: values.verbose ? ['verbose', ...(values.reporter ?? [])] : values.reporter,
    bail: toNumber(values.bail),
    retry: toNumber(values.retry),
    allowOnly: values.allowOnly,
    passWithNoTests: values.passWithNoTests,
    update: values.update,
    coverage: values.coverage,
    coverageDirectory: values.coverageDirectory ?? values['coverage.reportsDirectory'],
    splitFiles: values.splitFiles,
    shard: values.shard,
    lastFailed: values['last-failed'] ?? values.lastFailed,
    typecheckFlag: values['typecheck.only'] ? 'only' : values.typecheck,
    benchMode: values.bench,
    benchOutputJson: values.outputJson,
    benchCompare: values.compare,
    failOnFlaky: values['fail-on-flaky'] ?? values.failOnFlaky,
    outputDir: values.outputDir,
    ci: values.ci,
    isolate: values['no-isolate'] ? false : values.isolate,
    colors: values['no-color'] ? false : values.color,
    aiMode: values.ai,
  };
  const given = Object.fromEntries(Object.entries(options).filter(([, value]) => value !== undefined));
  // "jest ." means every file: a pattern that matches everything is no filter.
  const patterns = positionals.filter((pattern) => pattern !== '.' && pattern !== './');
  return {
    options: given,
    patterns,
    projects: values.project ?? [],
    help: values.help,
    version: values.version,
    watch: values.watch || values.watchAll,
    usage: USAGE,
  };
}

module.exports = { parseCli };
