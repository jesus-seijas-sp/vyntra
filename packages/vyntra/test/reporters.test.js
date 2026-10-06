const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { copyFixture } = require('./helpers/run-fixture');
const { reporterNames } = require('../src/cli/reporters');
const { fromVitestConfig } = require('../src/cli/vitest-config');

const BIN = path.join(__dirname, '..', 'bin', 'vyntra.js');

// The fixture fails one test (math > adds), has a flaky one, a skipped one, and a file that does not load: until FIX=1.
function project() {
  const dir = copyFixture('reporters');
  const run = (args = [], env = {}) =>
    spawnSync(process.execPath, [BIN, '--root', dir, '--no-color', ...args], {
      encoding: 'utf8',
      env: { ...process.env, CI: '', GITHUB_ACTIONS: '', FIX: '', GITHUB_STEP_SUMMARY: '', ...env },
    });
  const read = (file) => fs.readFileSync(path.join(dir, '.vyntra', file), 'utf8');
  const pages = () => fs.readdirSync(path.join(dir, '.vyntra', 'failures')).sort();
  return { dir, run, read, pages };
}

describe('reporterNames', () => {
  it('takes a list, names with commas, and the names vitest and Jest use', () => {
    expect(reporterNames(['default,junit', 'markdown'], {})).toEqual(['default', 'junit', 'markdown']);
    expect(reporterNames('github-actions, jest-junit', {})).toEqual(['github', 'junit']);
  });

  it('is the default reporter, with GitHub annotations under GitHub Actions', () => {
    expect(reporterNames(undefined, {})).toEqual(['default']);
    expect(reporterNames(undefined, { GITHUB_ACTIONS: 'true' })).toEqual(['default', 'github']);
    expect(reporterNames(['verbose'], { GITHUB_ACTIONS: 'true' })).toEqual(['verbose']);
  });

  it('reads the reporters of a vitest config it knows', () => {
    const config = fromVitestConfig({ test: { reporters: ['default', ['junit', {}], 'dot', 'github-actions'] } }, '.');
    expect(config.reporter).toEqual(['default', 'junit', 'github-actions']);
  });

  it('fails the run on an unknown reporter', () => {
    const { status, stderr } = project().run(['--reporter', 'fancy']);
    expect(status).toBe(2);
    expect(stderr).toContain('Unknown reporter: fancy');
  });
});

describe('junit reporter', () => {
  const { run, read } = project();
  run(['--reporter', 'default,junit']);
  const xml = read('junit.xml');

  it('writes a testsuite per file and a testcase per test', () => {
    expect(xml).toMatch(
      /^<\?xml version="1.0" encoding="UTF-8"\?>\n<testsuites name="vyntra" tests="5" failures="1" errors="1" skipped="1"/
    );
    expect(xml).toContain('<testsuite name="math.test.js" tests="4" failures="1" errors="0" skipped="1"');
    expect(xml).toContain('<testcase classname="math.test.js" name="math &gt; passes"');
  });

  it('writes failures with the assertion and the user frames only, flaky attempts, skips and file errors', () => {
    expect(xml).toContain(
      '<failure message="AssertionError: expect(received).toBe(expected) // Object.is equality · Expected: 3 · Received: 2"'
    );
    expect(xml).toMatch(/at [^\n]*math\.test\.js:7:\d+<\/failure>/);
    expect(xml).not.toContain('file-runner.js');
    expect(xml).toContain('<flakyFailure message="AssertionError');
    expect(xml).toContain('<skipped/>');
    expect(xml).toMatch(
      /<testcase classname="broken.test.js" name="broken.test.js" time="0">\n\s+<error message="Error: cannot load"/
    );
    expect(xml).toContain('name="math &gt; adds &lt;&amp;&gt;"');
  });
});

describe('markdown reporter', () => {
  const { run, read, pages } = project();
  run(['--reporter', 'markdown']);

  it('writes a summary that links a page per failed or flaky test', () => {
    const summary = read('summary.md');
    expect(summary).toContain('# vyntra: failed');
    expect(summary).toContain('- **Tests:** 1 failed, 1 flaky, 1 passed, 1 skipped (4)');
    expect(summary).toMatch(
      /## Failed \(2\)\n\n- \[`broken.test.js`\]\(failures\/broken-test-js-[0-9a-f]{8}\.md\): Error: cannot load\n- \[`math.test.js > math > adds <&>`\]\(failures\/math-test-js-math-adds-[0-9a-f]{8}\.md\): AssertionError/
    );
    expect(summary).toMatch(/## Flaky \(1\)\n\n- \[`math.test.js > math > retries`\]/);
    expect(pages()).toHaveLength(3);
  });

  it('gives each failure its error, source line, console output and the command that reruns it', () => {
    const page = read(`failures/${pages().find((name) => name.startsWith('math-test-js-math-adds'))}`);
    expect(page).toContain('- **Status:** failed');
    expect(page).toContain('Expected: 3\nReceived: 2');
    expect(page).toMatch(/> +7 \| +expect\(1 \+ 1\)\.toBe\(fixed \? 2 : 3\);/);
    expect(page).toContain('log: adding "1" & <1>');
    expect(page).toContain("npx vyntra math.test.js -t 'math adds <&>'");
  });

  it('shows the attempts that failed for a flaky test', () => {
    const page = read(`failures/${pages().find((name) => name.startsWith('math-test-js-math-retries'))}`);
    expect(page).toContain('- **Status:** flaky: passed on attempt 2 of 2');
    expect(page).toContain('## Attempt 1 (failed)');
  });

  it('drops the pages of what passes on --last-failed, and clears them on a new run', () => {
    run(['--reporter', 'markdown', '--last-failed'], { FIX: '1' });
    expect(pages()).toEqual([expect.stringMatching(/^math-test-js-math-retries/)]);
    run(['--reporter', 'default'], { FIX: '1' });
    expect(fs.existsSync(path.join(project().dir, '.vyntra', 'failures'))).toBe(false);
  });
});

describe('github reporter', () => {
  it('annotates the failing lines and writes the job summary under GitHub Actions', () => {
    const { dir, run } = project();
    const summary = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'vyntra-gh-')), 'summary.md');
    const { stdout } = run([], { GITHUB_ACTIONS: 'true', GITHUB_STEP_SUMMARY: summary, GITHUB_WORKSPACE: dir });
    const annotations = stdout
      .split('\n')
      .filter((line) => line.startsWith('::'))
      .sort((a, b) => a.localeCompare(b));
    expect(annotations).toEqual([
      expect.stringMatching(/^::error file=broken.test.js,line=2,col=\d+,title=broken.test.js::Error: cannot load$/),
      expect.stringMatching(
        /^::error file=math.test.js,line=7,col=\d+,title=math.test.js > math > adds <&>::AssertionError: .*%0AExpected: 3%0AReceived: 2$/
      ),
      expect.stringMatching(
        /^::warning file=math.test.js,line=12,col=\d+,title=Flaky%3A math.test.js > math > retries::/
      ),
    ]);
    expect(fs.readFileSync(summary, 'utf8')).toContain('# vyntra: failed');
  });

  it('does nothing elsewhere', () => {
    const { stdout } = project().run(['--reporter', 'default,github']);
    expect(stdout).not.toContain('::error');
  });
});
