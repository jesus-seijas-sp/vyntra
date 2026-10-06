const path = require('node:path');
const { parseArgs } = require('node:util');
const { loadProject } = require('../tooling');
const { enginesOf, loadEngine } = require('../engines');
const { EXIT } = require('./exit-codes');

const USAGE = `Usage: vyntra explore [options] '<goal>'

An agent explores the app toward a goal, with no test file: it plans its steps, drives the app, and reports what it
finds (issues, then warnings) in .vyntra/explore.md and .vyntra/explore.json. Needs @vyntra/ai and @vyntra/web.

Options:
  --project <name>    The project whose servers, baseURL and AI options to use (default: the first web one)
  --url <path|url>    Where to start (default: the baseURL)
  --max-steps <n>     Steps to plan, 1 to 12 (default: 8)
  --timeout <ms>      Wall clock, 3 to 15 minutes (default: 10 minutes)
  --headed            Show the browser
  -r, --root <dir>    Project root (default: current directory)
`;

// vyntra explore '<goal>': the engine that explores (@vyntra/ai, from the project's engines or its dependencies)
// runs it on the project the config describes. The exit code: 0 nothing wrong found, 1 an issue found (or nothing
// could run), 2 or 3 a problem of the setup or the environment.
async function explore(argv) {
  const { values, positionals } = parseArgs({
    args: argv,
    options: {
      project: { type: 'string' },
      url: { type: 'string' },
      'max-steps': { type: 'string' },
      timeout: { type: 'string' },
      headed: { type: 'boolean' },
      root: { type: 'string', short: 'r' },
      help: { type: 'boolean', short: 'h' },
    },
    allowPositionals: true,
  });
  if (values.help) {
    process.stdout.write(USAGE);
    return 0;
  }
  const rootDir = path.resolve(values.root ?? process.cwd());
  const goal = positionals.join(' ').trim() || 'Explore the app and find bugs';
  let project;
  try {
    project = await loadProject(rootDir, values.project ?? null);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    return EXIT.setup;
  }
  const engine =
    enginesOf(project.config).find(({ engine: candidate }) => typeof candidate.explore === 'function')?.engine ??
    loadEngine('ai', rootDir);
  return engine.explore({
    goal,
    project,
    rootDir,
    url: values.url,
    maxSteps: values['max-steps'] === undefined ? undefined : Number(values['max-steps']),
    timeout: values.timeout === undefined ? undefined : Number(values.timeout),
    headed: values.headed === true,
  });
}

module.exports = { explore, USAGE };
