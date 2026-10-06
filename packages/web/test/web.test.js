const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const BIN = path.join(path.dirname(require.resolve('vyntra/package.json')), 'bin', 'vyntra.js');
const FIXTURES = path.join(__dirname, 'fixtures');

// A copy of a fixture to run in, as runs write .vyntra/.
function project(name) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `vyntra-web-${name}-`));
  fs.cpSync(path.join(FIXTURES, name), dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'vyntra.config.js'),
    fs
      .readFileSync(path.join(FIXTURES, name, 'vyntra.config.js'), 'utf8')
      .replace(
        "path.join(__dirname, '../../../src/index.js')",
        JSON.stringify(path.join(__dirname, '..', 'src', 'index.js'))
      )
  );
  const run = (args = [], env = {}) =>
    spawnSync(process.execPath, [BIN, '--root', dir, '--no-color', ...args], {
      encoding: 'utf8',
      env: { ...process.env, CI: '', GITHUB_ACTIONS: '', ...env },
    });
  return { dir, run };
}

describe('web engine', () => {
  it('runs page tests with retrying matchers, in processes of their own', () => {
    const { run } = project('basic');
    const { status, stdout } = run(['--reporter', 'json']);
    const report = JSON.parse(stdout.split('\n').find((line) => line.startsWith('{"success"')));
    const statuses = report.files.flatMap((file) => file.tests.map((test) => [test.name, test.status]));
    expect(Object.fromEntries(statuses)).toEqual({
      'adds a todo, waiting for the page': 'passed',
      'fails with what the page showed': 'passed',
      'matchers retry, and .not waits for the opposite': 'passed',
      'says what it takes': 'passed',
    });
    expect(status).toBe(0);
  });

  it('leaves a screenshot, the accessibility tree, the console and a trace for a failure', () => {
    const { dir, run } = project('basic');
    const { status, stdout } = run(['page.e2e.js', '--reporter', 'default,markdown'], { BREAK_WEB: '1' });
    expect(status).toBe(1);
    expect(stdout).toContain('Locator: getByRole(\'listitem\')\nExpected: "Run"\nReceived: "Walk"');
    const failures = path.join(dir, '.vyntra', 'failures');
    const page = fs.readFileSync(path.join(failures, fs.readdirSync(failures)[0]), 'utf8');
    const screenshot = /!\[screenshot\]\((\.\.\/artifacts\/[^)]+\/attempt-2\/screenshot\.png)\)/.exec(page)?.[1];
    const trace = /\[trace\.zip\]\((\.\.\/artifacts\/[^)]+\/attempt-2\/trace\.zip)\)/.exec(page)?.[1];
    expect(fs.statSync(path.join(failures, screenshot)).size).toBeGreaterThan(1000);
    expect(fs.readFileSync(path.join(failures, trace)).subarray(0, 2).toString()).toBe('PK');
    expect(page).toContain('```yaml\n- heading "Todos" [level=1]');
    expect(page).toContain('  - listitem: Walk');
    expect(page).toContain('log: added Walk');
    expect(page).toMatch(/npx playwright show-trace \.vyntra\/artifacts\/[^\n]+\/attempt-2\/trace\.zip/);
    expect(page).toContain('## Attempt 1 (failed)');
  });

  it('refuses a browser it does not know', () => {
    const { dir, run } = project('basic');
    fs.appendFileSync(path.join(dir, 'vyntra.config.js'), "module.exports.use = { browserName: 'netscape' };\n");
    const { stdout } = run(['more.e2e.js', '--retry', '0']);
    expect(stdout).toContain('use.browserName is netscape: chromium, firefox or webkit');
  });
});
