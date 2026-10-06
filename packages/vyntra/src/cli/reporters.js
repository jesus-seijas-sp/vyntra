const fs = require('node:fs');
const path = require('node:path');
const { Reporter } = require('./reporter');
const { JsonReporter } = require('./json-reporter');
const { JunitReporter } = require('./junit-reporter');
const { MarkdownReporter } = require('./markdown-reporter');
const { GithubReporter } = require('./github-reporter');

// One of these prints the run; the others write files (or GitHub annotations) next to it.
const CONSOLE = { default: Reporter, verbose: Reporter, json: JsonReporter };
const FILES = { junit: JunitReporter, markdown: MarkdownReporter, github: GithubReporter };
const ALIASES = { 'github-actions': 'github', 'jest-junit': 'junit' };

// What the reporters of a run write, which a new run clears first (--last-failed keeps them: it adds to that run).
const OUTPUTS = ['junit.xml', 'summary.md', 'failures'];

// The reporters asked for: a list, or names separated by commas. None asked for: the default one, and GitHub's under
// GitHub Actions, as vitest does.
function reporterNames(reporter, env = process.env) {
  if (reporter === undefined || reporter === null || reporter.length === 0) {
    return env.GITHUB_ACTIONS === 'true' ? ['default', 'github'] : ['default'];
  }
  return [reporter]
    .flat()
    .flatMap((name) => String(name).split(','))
    .map((name) => name.trim())
    .filter(Boolean)
    .map((name) => ALIASES[name] ?? name);
}

function unknownReporters(names) {
  return names.filter((name) => !CONSOLE[name] && !FILES[name]);
}

// Hands every event to each reporter; the run succeeded if the one printing it says so.
class Reporters {
  constructor(reporters) {
    this.reporters = reporters;
  }

  onStart(...args) {
    this.reporters.forEach((reporter) => reporter.onStart(...args));
  }

  onFileResult(result) {
    this.reporters.forEach((reporter) => reporter.onFileResult(result));
  }

  onFinish(duration) {
    const [main, ...others] = this.reporters;
    const passed = main.onFinish(duration);
    others.forEach((reporter) => reporter.onFinish(duration));
    return passed;
  }
}

function createReporters(names, config) {
  const printing = names.filter((name) => CONSOLE[name]).at(-1) ?? 'default';
  const main = new CONSOLE[printing]({ ...config, reporter: printing });
  const files = [...new Set(names.filter((name) => FILES[name]))].map((name) => new FILES[name](config));
  return new Reporters([main, ...files]);
}

function clearOutputs(config) {
  if (!config.outputDir) {
    return;
  }
  OUTPUTS.forEach((name) =>
    fs.rmSync(path.resolve(config.rootDir, config.outputDir, name), { recursive: true, force: true })
  );
}

module.exports = { reporterNames, unknownReporters, createReporters, clearOutputs };
