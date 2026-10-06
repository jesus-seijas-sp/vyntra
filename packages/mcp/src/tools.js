const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const Module = require('node:module');
const { parseLocator, buildLocator } = require('./locator');

// The tools of vyntra's MCP server, for coding agents working on a project's tests: run them, see what failed and
// why (the failure pages), read the documentation, and try a locator on a page before writing an end-to-end test.

const EXIT_MEANINGS = {
  0: 'every test passed',
  1: 'a test failed',
  2: 'the setup is broken: the config or a test file did not load, or no test files were found',
  3: 'something the tests need did not start (a server)',
  4: 'vyntra itself failed',
};
const MAX_TEXT = 40;

// vyntra's command line, from the project's dependencies (or the one installed with this server).
function vyntraBin(rootDir) {
  const fromProject = Module.createRequire(path.join(rootDir, 'package.json'));
  let manifest;
  try {
    manifest = fromProject.resolve('vyntra/package.json');
  } catch {
    manifest = require.resolve('vyntra/package.json');
  }
  return path.join(path.dirname(manifest), 'bin', 'vyntra.js');
}

function runVyntra(rootDir, args) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [vyntraBin(rootDir), ...args], {
      cwd: rootDir,
      env: { ...process.env, NO_COLOR: '1', GITHUB_ACTIONS: '' },
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('close', (status) => resolve({ status, stdout, stderr }));
  });
}

const text = (value) => ({ type: 'text', text: value });

function outputDirOf(rootDir) {
  return path.join(rootDir, '.vyntra');
}

// The failed and flaky tests of the last run, from its report, with the page that explains each.
function failuresOf(rootDir) {
  const dir = outputDirOf(rootDir);
  const reportFile = path.join(dir, 'report.json');
  if (!fs.existsSync(reportFile)) {
    return null;
  }
  const report = JSON.parse(fs.readFileSync(reportFile, 'utf8'));
  const summary = fs.existsSync(path.join(dir, 'summary.md'))
    ? fs.readFileSync(path.join(dir, 'summary.md'), 'utf8')
    : '';
  const pages = new Map(
    [...summary.matchAll(/^- \[`(.+?)`\]\((failures\/[^)]+)\)/gm)].map(([, title, page]) => [title, page])
  );
  const list = report.files.flatMap((file) => {
    const where = file.project ? `[${file.project}] ${file.path}` : file.path;
    return [
      ...file.errors.map((error) => ({ title: where, status: 'failed', error: error.message })),
      ...file.tests
        .filter((test) => test.status === 'failed' || test.status === 'flaky')
        .map((test) => ({
          title: `${where} > ${test.path.join(' > ')}`,
          status: test.status,
          error: (test.errors[0] ?? test.attempts?.[0]?.errors[0])?.message,
        })),
    ];
  });
  return {
    exitCode: report.exitCode,
    failures: list.map((item) => {
      const page = pages.get(item.title);
      return {
        ...item,
        error: item.error?.split('\n').find((line) => line.trim()) ?? '',
        page: page ? path.join('.vyntra', page) : null,
      };
    }),
  };
}

function describeFailures(found) {
  if (found.failures.length === 0) {
    return 'Nothing failed.';
  }
  return found.failures
    .map(
      ({ title, status, error, page }) =>
        `- ${status === 'flaky' ? 'FLAKY ' : ''}${title}\n  ${error}${page ? `\n  page: ${page}` : ' (run with the markdown reporter for its page)'}`
    )
    .join('\n');
}

function createTools({ rootDir }) {
  const root = (args) => path.resolve(rootDir, args.root ?? '.');
  let browser = null;

  const runTests = {
    name: 'run_tests',
    title: 'Run tests',
    description:
      "Runs the project's tests with vyntra, and says what failed with the page that explains each failure (read it with read_failure). With no arguments, every test; narrow it with files, a test name, projects, or lastFailed to rerun only what failed before.",
    inputSchema: {
      type: 'object',
      properties: {
        files: { type: 'array', items: { type: 'string' }, description: 'Paths, or parts of paths, of the test files' },
        testNamePattern: { type: 'string', description: 'A regular expression the full test names must match' },
        projects: { type: 'array', items: { type: 'string' }, description: 'Projects of the config to run' },
        lastFailed: { type: 'boolean', description: 'Run only what failed in the last run' },
        root: { type: 'string', description: "The project directory, from the server's" },
      },
      additionalProperties: false,
    },
    async call(args) {
      const dir = root(args);
      const cli = ['--reporter', 'json,markdown', '--no-color'];
      if (args.testNamePattern) {
        cli.push('-t', args.testNamePattern);
      }
      (args.projects ?? []).forEach((project) => cli.push('--project', project));
      if (args.lastFailed) {
        cli.push('--last-failed');
      }
      cli.push(...(args.files ?? []));
      const { status, stdout, stderr } = await runVyntra(dir, cli);
      const line = stdout.split('\n').find((one) => one.startsWith('{"success"'));
      const meaning = EXIT_MEANINGS[status] ?? `exit code ${status}`;
      if (!line) {
        const said = `${stdout}${stderr}`.trim().split('\n').slice(-MAX_TEXT).join('\n');
        return { content: [text(`No tests ran: ${meaning}.\n\n${said}`)], isError: status !== 0 };
      }
      const report = JSON.parse(line);
      const tests = report.files.flatMap((file) => file.tests);
      const count = (wanted) => tests.filter((test) => test.status === wanted).length;
      const counts = {
        passed: count('passed'),
        failed: count('failed'),
        flaky: count('flaky'),
        skipped: count('skipped'),
      };
      const found = failuresOf(dir) ?? { failures: [] };
      const head = `Exit code ${status}: ${meaning}. ${counts.passed} passed, ${counts.failed} failed, ${counts.flaky} flaky, ${counts.skipped} skipped, in ${report.files.length} files.`;
      return {
        content: [text(`${head}\n\n${describeFailures(found)}`)],
        structuredContent: { exitCode: status, ...counts, failures: found.failures },
      };
    },
  };

  const listFailures = {
    name: 'list_failures',
    title: 'List failures',
    description:
      'The failed and flaky tests of the last run, each with its error and the page that explains it, without running anything.',
    inputSchema: {
      type: 'object',
      properties: { root: { type: 'string', description: "The project directory, from the server's" } },
      additionalProperties: false,
    },
    async call(args) {
      const found = failuresOf(root(args));
      if (!found) {
        return { content: [text('No run yet: run_tests first.')], isError: true };
      }
      return { content: [text(describeFailures(found))], structuredContent: found };
    },
  };

  const readFailure = {
    name: 'read_failure',
    title: 'Read a failure page',
    description:
      'The failure page of a test: the error and the source line where it happened, every attempt, the console output, and the command that reruns it; for an API test its requests and responses, for an end-to-end test a screenshot (returned as an image), the accessibility tree, console, network and trace.',
    inputSchema: {
      type: 'object',
      properties: {
        test: { type: 'string', description: "The page (as list_failures gives it), or part of the test's name" },
        root: { type: 'string', description: "The project directory, from the server's" },
      },
      required: ['test'],
      additionalProperties: false,
    },
    async call(args) {
      const dir = root(args);
      const failures = path.join(outputDirOf(dir), 'failures');
      if (!fs.existsSync(failures)) {
        return { content: [text('No failure pages: run_tests first.')], isError: true };
      }
      const pages = fs.readdirSync(failures);
      const wanted = args.test.toLowerCase();
      const byFile = pages.find((page) => wanted.endsWith(page.toLowerCase()));
      const byTitle = pages.filter((page) =>
        fs.readFileSync(path.join(failures, page), 'utf8').split('\n')[0].toLowerCase().includes(wanted)
      );
      const page = byFile ?? (byTitle.length === 1 ? byTitle[0] : null);
      if (!page) {
        const which =
          byTitle.length > 1 ? `Several pages match: ${byTitle.join(', ')}` : `No page matches "${args.test}"`;
        return { content: [text(`${which}. list_failures gives the pages.`)], isError: true };
      }
      const markdown = fs.readFileSync(path.join(failures, page), 'utf8');
      const content = [text(markdown)];
      const screenshot = /!\[screenshot\]\(([^)]+)\)/.exec(markdown)?.[1];
      const image = screenshot && path.resolve(failures, screenshot);
      if (image && fs.existsSync(image)) {
        content.push({ type: 'image', data: fs.readFileSync(image).toString('base64'), mimeType: 'image/png' });
      }
      return { content };
    },
  };

  const guide = {
    name: 'guide',
    title: 'vyntra documentation',
    description:
      'The documentation of the vyntra in the project: with no topic, the list of topics; with one (projects, api-tests, e2e, mocks, api/config...), that topic.',
    inputSchema: {
      type: 'object',
      properties: {
        topic: { type: 'string', description: 'A topic of the list' },
        root: { type: 'string', description: "The project directory, from the server's" },
      },
      additionalProperties: false,
    },
    async call(args) {
      const { status, stdout, stderr } = await runVyntra(root(args), ['guide', ...(args.topic ? [args.topic] : [])]);
      return { content: [text(status === 0 ? stdout : stderr)], isError: status !== 0 };
    },
  };

  const tryLocator = {
    name: 'try_locator',
    title: 'Try a locator on a page',
    description:
      "Opens a URL in a browser (Playwright, from the project) and tries a locator on it, as an end-to-end test would: how many elements match, their text and whether they are visible. Without a locator, or when nothing matches, it gives the page's accessibility tree, to choose one from. Locators are Playwright's, written as code: getByRole('button', { name: 'Add' }), getByText(/milk/i).first().",
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'The page to open: a full URL' },
        locator: { type: 'string', description: 'A Playwright locator chain' },
        root: { type: 'string', description: "The project directory, from the server's" },
      },
      required: ['url'],
      additionalProperties: false,
    },
    async call(args) {
      const calls = args.locator ? parseLocator(args.locator) : null;
      if (!browser) {
        const fromProject = Module.createRequire(path.join(root(args), 'package.json'));
        let playwright;
        try {
          playwright = fromProject('playwright');
        } catch {
          try {
            // eslint-disable-next-line global-require -- the one installed with this server, an optional peer
            playwright = require('playwright');
          } catch {
            throw new Error('try_locator needs Playwright in the project: npm install --save-dev playwright');
          }
        }
        browser = await playwright.chromium.launch();
      }
      const context = await browser.newContext();
      try {
        const page = await context.newPage();
        await page.goto(args.url, { timeout: 15_000 });
        const lines = [`Page: ${page.url()} (${await page.title()})`];
        let showTree = !calls;
        if (calls) {
          const locator = buildLocator(page, calls);
          const count = await locator.count();
          lines.push(`Locator: ${args.locator}`, `Matches: ${count}`);
          const shown = Math.min(count, 10);
          for (let i = 0; i < shown; i += 1) {
            const element = locator.nth(i);
            // eslint-disable-next-line no-await-in-loop -- one element after the other, in the page's order
            const [content, visible] = await Promise.all([element.textContent(), element.isVisible()]);
            lines.push(
              `  ${i + 1}. ${visible ? 'visible' : 'hidden'}: ${JSON.stringify((content ?? '').replace(/\s+/g, ' ').trim())}`
            );
          }
          showTree = count === 0;
        }
        if (showTree) {
          lines.push('', 'Accessibility tree:', await page.locator('body').ariaSnapshot());
        }
        return { content: [text(lines.join('\n'))] };
      } finally {
        await context.close();
      }
    },
  };

  const close = async () => {
    await browser?.close();
  };

  return { tools: [runTests, listFailures, readFailure, guide, tryLocator], close };
}

module.exports = { createTools };
