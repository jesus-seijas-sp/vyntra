const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { byPath, stripAnsi, relative, oneLine, userStack } = require('./outcomes');

// eslint-disable-next-line no-control-regex
const INVALID_XML = /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g;

const escape = (text) =>
  stripAnsi(text)
    .replace(INVALID_XML, '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

const seconds = (ms) => ((ms ?? 0) / 1000).toFixed(3);

// The first line of an error, for the message attribute; the whole of it, with its stack, as the element's text.
function problem(tag, error) {
  return `<${tag} message="${escape(oneLine(error))}" type="${escape(error.name)}">${escape(userStack(error))}</${tag}>`;
}

function testcase(file, test) {
  const open = `    <testcase classname="${escape(file)}" name="${escape(test.path.join(' > '))}" time="${seconds(test.duration)}"`;
  const inner = [];
  if (test.status === 'failed') {
    test.errors.forEach((error) => inner.push(`      ${problem('failure', error)}`));
  } else if (test.status === 'skipped' || test.status === 'todo') {
    inner.push('      <skipped/>');
  } else if (test.status === 'flaky') {
    (test.attempts ?? []).forEach(({ errors }) => {
      errors.slice(0, 1).forEach((error) => inner.push(`      ${problem('flakyFailure', error)}`));
    });
  }
  return inner.length > 0 ? [`${open}>`, ...inner, '    </testcase>'] : [`${open}/>`];
}

// .vyntra/junit.xml: a testsuite per file, a testcase per test, read by most CI systems. Errors outside the tests (a
// file that did not load) are a testcase of their own; the failed attempts of a flaky test are flakyFailure
// elements, as Maven Surefire writes them.
class JunitReporter {
  constructor(config) {
    this.config = config;
    this.results = [];
    this.startedAt = new Date().toISOString();
  }

  // eslint-disable-next-line class-methods-use-this
  onStart() {}

  onFileResult(result) {
    this.results.push(result);
  }

  suite(result) {
    const file = relative(this.config.rootDir, result.path);
    const failures = result.tests.filter((test) => test.status === 'failed').length;
    const skipped = result.tests.filter((test) => test.status === 'skipped' || test.status === 'todo').length;
    const errors = result.errors.length;
    const tests = result.tests.length + (errors > 0 ? 1 : 0);
    const attributes = `name="${escape(file)}" tests="${tests}" failures="${failures}" errors="${errors}" skipped="${skipped}" time="${seconds(result.duration)}" timestamp="${this.startedAt}" hostname="${escape(os.hostname())}"`;
    const cases = result.tests.flatMap((test) => testcase(file, test));
    if (errors > 0) {
      cases.push(
        `    <testcase classname="${escape(file)}" name="${escape(file)}" time="0">`,
        ...result.errors.map((error) => `      ${problem('error', error)}`),
        '    </testcase>'
      );
    }
    return [`  <testsuite ${attributes}>`, ...cases, '  </testsuite>'];
  }

  onFinish(duration) {
    const sum = (pick) => this.results.reduce((total, result) => total + pick(result), 0);
    const tests = sum((result) => result.tests.length + (result.errors.length > 0 ? 1 : 0));
    const failures = sum((result) => result.tests.filter((test) => test.status === 'failed').length);
    const errors = sum((result) => result.errors.length);
    const skipped = sum((result) => result.tests.filter((test) => ['skipped', 'todo'].includes(test.status)).length);
    const xml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      `<testsuites name="vyntra" tests="${tests}" failures="${failures}" errors="${errors}" skipped="${skipped}" time="${seconds(duration)}">`,
      ...byPath(this.results).flatMap((result) => this.suite(result)),
      '</testsuites>',
      '',
    ].join('\n');
    const file = path.resolve(this.config.rootDir, this.config.outputDir || '.vyntra', 'junit.xml');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, xml);
    return true;
  }
}

module.exports = { JunitReporter };
