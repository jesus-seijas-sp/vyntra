const fs = require('node:fs');
const { describeError, locate, outcomesOf, relative } = require('./outcomes');
const { summaryOf } = require('./markdown-reporter');

// Workflow commands: https://docs.github.com/actions/reference/workflow-commands-for-github-actions
const escapeData = (text) => text.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A');
const escapeProperty = (text) => escapeData(text).replaceAll(':', '%3A').replaceAll(',', '%2C');

// Under GitHub Actions: an annotation on the line of each failure (a warning for a flaky test), and the run's summary
// on the job's page. Elsewhere it does nothing.
class GithubReporter {
  constructor(config, out = process.stdout, env = process.env) {
    this.config = config;
    this.out = out;
    this.env = env;
    this.results = [];
  }

  // eslint-disable-next-line class-methods-use-this
  onStart() {}

  onFileResult(result) {
    this.results.push(result);
  }

  annotation(outcome) {
    const flaky = outcome.status === 'flaky';
    const error = flaky ? outcome.attempts[0]?.errors[0] : outcome.errors[0];
    const frame = error && locate(error, outcome.path);
    const workspace = this.env.GITHUB_WORKSPACE || this.config.rootDir;
    const file = relative(workspace, frame?.file ?? outcome.path);
    const properties = [
      `file=${escapeProperty(file)}`,
      frame && `line=${frame.line}`,
      frame && `col=${frame.column}`,
      `title=${escapeProperty(`${flaky ? 'Flaky: ' : ''}${outcome.title}`)}`,
    ].filter(Boolean);
    const message = error ? describeError(error) : 'failed';
    return `::${flaky ? 'warning' : 'error'} ${properties.join(',')}::${escapeData(message)}\n`;
  }

  onFinish(duration) {
    if (this.env.GITHUB_ACTIONS !== 'true') {
      return true;
    }
    this.out.write(
      outcomesOf(this.results, this.config.rootDir)
        .map((outcome) => this.annotation(outcome))
        .join('')
    );
    if (this.env.GITHUB_STEP_SUMMARY) {
      fs.appendFileSync(this.env.GITHUB_STEP_SUMMARY, summaryOf(this.results, this.config.rootDir, duration));
    }
    return true;
  }
}

module.exports = { GithubReporter };
