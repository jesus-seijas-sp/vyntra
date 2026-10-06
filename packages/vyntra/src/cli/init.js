const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline/promises');
const { parseArgs } = require('node:util');
const { init: installSkill } = require('./guide');

// vyntra init: sets a project up for unit, API, end-to-end and AI tests in one config. It asks which kinds of
// tests, how the app starts and which model the AI steps use (or takes them from flags, with --yes or without a
// terminal), then writes the config, an example test of each kind, the skill for coding agents, the MCP server in
// .mcp.json, .vyntra/ in .gitignore and a test script, and says what to install. It replaces nothing without --force.

const KINDS = ['api', 'e2e', 'ai'];
const PROVIDERS = {
  anthropic: { key: 'ANTHROPIC_API_KEY', model: 'claude-opus-5-5' },
  openrouter: { key: 'OPENROUTER_API_KEY', model: null },
  openai: { key: 'OPENAI_API_KEY', model: null },
};

const USAGE = `Usage: vyntra init [options]

Sets the project up for unit, API, end-to-end and AI tests: asks, then writes vyntra.config.js, example tests, the
skill for coding agents and .mcp.json. With --yes, or without a terminal, it takes these instead of asking:

  --kinds <list>       api, e2e and ai, comma-separated (default: api,e2e)
  --command <cmd>      How the app starts (default: npm start)
  --url <url>          Where it answers (default: http://localhost:3000)
  --provider <name>    The model of the AI steps: anthropic, openrouter or openai (default: anthropic)
  --model <id>         The model (default: the provider's)
  --force              Replace files that are there
  --yes                Ask nothing
  --ask                Ask, even without a terminal
`;

const exists = (rootDir, file) => fs.existsSync(path.join(rootDir, file));

// The package manager the project uses, from its lockfile.
function installer(rootDir) {
  if (exists(rootDir, 'pnpm-lock.yaml')) {
    return { add: 'pnpm add -D', exec: 'pnpm exec' };
  }
  if (exists(rootDir, 'yarn.lock')) {
    return { add: 'yarn add -D', exec: 'yarn' };
  }
  if (exists(rootDir, 'bun.lock') || exists(rootDir, 'bun.lockb')) {
    return { add: 'bun add -d', exec: 'bunx' };
  }
  return { add: 'npm install -D', exec: 'npx' };
}

function configOf({ kinds, command, url, provider, model }) {
  const ai = kinds.includes('ai');
  const web = kinds.includes('e2e') || ai;
  const server = kinds.includes('api') || web;
  const projects = [
    `    { name: 'unit', include: ['**/*.test.{js,mjs,cjs,ts,tsx}'], exclude: ['**/node_modules/**', 'tests/**'] },`,
  ];
  if (kinds.includes('api')) {
    projects.push(`    { name: 'api', include: ['tests/api/**/*.test.{js,ts}'], dependsOn: ['unit'] },`);
  }
  if (web) {
    const engine = ai ? "['web', 'ai']" : "'web'";
    const after = kinds.includes('api') ? 'api' : 'unit';
    projects.push(
      `    { name: 'e2e', include: ['tests/e2e/**/*.e2e.{js,ts}'], engine: ${engine}, dependsOn: ['${after}'] },`
    );
  }
  const use = [`    baseURL: ${JSON.stringify(url)},`];
  if (ai) {
    const settings = [`provider: ${JSON.stringify(provider)}`, ...(model ? [`model: ${JSON.stringify(model)}`] : [])];
    use.push(`    // The model of the AI steps; its key comes from ${PROVIDERS[provider].key} in the environment.`);
    use.push(`    ai: { ${settings.join(', ')} },`);
  }
  return [
    '// One config for every kind of test of the project, written by vyntra init.',
    'module.exports = {',
    ...(server
      ? [
          '  // Started before the tests that need it, and stopped after them.',
          `  server: { command: ${JSON.stringify(command)}, url: ${JSON.stringify(url)}, reuseExisting: !process.env.CI },`,
          '  use: {',
          ...use,
          '  },',
        ]
      : []),
    '  projects: [',
    ...projects,
    '  ],',
    '};',
    '',
  ].join('\n');
}

const EXAMPLES = {
  api: [
    'tests/api/example.test.js',
    `// An API test: the api fixture calls the app the config starts, on its baseURL.
test('the app answers', async ({ api }) => {
  const response = await api.get('/');
  expect(response.status).toBeLessThan(500);
});
`,
  ],
  e2e: [
    'tests/e2e/example.e2e.js',
    `// An end-to-end test: a page of a real browser, and assertions that wait for the page.
test('the home page shows a heading', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading').first()).toBeVisible();
});
`,
  ],
  ai: [
    'tests/e2e/example-ai.e2e.js',
    `// An AI step: a model judges a claim about the page. Its verdict is recorded in vyntra.ai-cache/ the first time
// (where a model key is set) and replayed after that, in CI with no key: commit the recordings.
test('the home page says what the app is for', async ({ page, agent }) => {
  await page.goto('/');
  await agent.assert('the page says what the app is for');
});
`,
  ],
};

// .mcp.json with the vyntra server added to what is there.
function addMcp(rootDir) {
  const file = path.join(rootDir, '.mcp.json');
  let config = {};
  if (fs.existsSync(file)) {
    try {
      config = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
      return 'left .mcp.json as it is: it is not JSON';
    }
  }
  if (config.mcpServers?.vyntra) {
    return null;
  }
  config.mcpServers = { ...config.mcpServers, vyntra: { command: 'npx', args: ['vyntra-mcp'] } };
  fs.writeFileSync(file, `${JSON.stringify(config, null, 2)}\n`);
  return 'added the vyntra MCP server to .mcp.json';
}

function addGitignore(rootDir) {
  const file = path.join(rootDir, '.gitignore');
  const text = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  if (/^\/?\.vyntra\/?$/m.test(text)) {
    return null;
  }
  const separator = text === '' || text.endsWith('\n') ? '' : '\n';
  fs.writeFileSync(file, `${text}${separator}# vyntra's run output (reports, failure pages, artifacts)\n.vyntra/\n`);
  return 'added .vyntra/ to .gitignore';
}

function addScript(rootDir) {
  const file = path.join(rootDir, 'package.json');
  if (!fs.existsSync(file)) {
    return null;
  }
  const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (manifest.scripts?.test && !/no test specified/.test(manifest.scripts.test)) {
    return `kept the test script (${manifest.scripts.test}): "vyntra" runs these tests`;
  }
  manifest.scripts = { ...manifest.scripts, test: 'vyntra' };
  fs.writeFileSync(file, `${JSON.stringify(manifest, null, 2)}\n`);
  return 'set the test script to "vyntra"';
}

async function ask(defaults) {
  const prompt = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: false });
  // Lines read one at a time as they are asked for: answers piped in all at once are not lost, and an input that
  // ends early leaves the rest at their defaults.
  const lines = prompt[Symbol.asyncIterator]();
  const question = async (text, fallback) => {
    process.stdout.write(`${text} (${fallback}): `);
    const { value, done } = await lines.next();
    if (!process.stdin.isTTY) {
      process.stdout.write('\n');
    }
    return (done ? '' : value).trim() || fallback;
  };
  try {
    const kinds = (await question('Kinds of tests besides unit tests: api, e2e, ai', defaults.kinds.join(',')))
      .split(',')
      .map((kind) => kind.trim());
    const answers = { ...defaults, kinds };
    if (kinds.some((kind) => KINDS.includes(kind))) {
      answers.command = await question('How the app starts', defaults.command);
      answers.url = await question('Where it answers', defaults.url);
    }
    if (kinds.includes('ai')) {
      answers.provider = await question('The model provider: anthropic, openrouter or openai', defaults.provider);
      answers.model =
        (await question("The model (empty: the provider's)", defaults.model ?? '-')).replace(/^-$/, '') || null;
    }
    return answers;
  } finally {
    prompt.close();
  }
}

async function wizard(argv, rootDir = process.cwd(), out = process.stdout) {
  const { values } = parseArgs({
    args: argv,
    options: {
      kinds: { type: 'string' },
      command: { type: 'string' },
      url: { type: 'string' },
      provider: { type: 'string' },
      model: { type: 'string' },
      force: { type: 'boolean' },
      yes: { type: 'boolean' },
      ask: { type: 'boolean' },
      help: { type: 'boolean', short: 'h' },
    },
  });
  if (values.help) {
    out.write(USAGE);
    return 0;
  }
  if (exists(rootDir, 'vyntra.config.js') && !values.force) {
    process.stderr.write('vyntra.config.js exists: --force replaces it (and the example tests)\n');
    return 1;
  }
  const defaults = {
    kinds: (values.kinds ?? 'api,e2e')
      .split(',')
      .map((kind) => kind.trim())
      .filter(Boolean),
    command: values.command ?? 'npm start',
    url: values.url ?? 'http://localhost:3000',
    provider: values.provider ?? 'anthropic',
    model: values.model ?? null,
  };
  // --ask asks even without a terminal (answers piped in).
  const asking = values.ask || (!values.yes && process.stdin.isTTY);
  const answers = asking ? await ask(defaults) : defaults;
  const unknown = answers.kinds.filter((kind) => !KINDS.includes(kind));
  if (unknown.length > 0 || !PROVIDERS[answers.provider]) {
    process.stderr.write(
      unknown.length > 0
        ? `Unknown kinds: ${unknown.join(', ')} (${KINDS.join(', ')})\n`
        : `Unknown provider: ${answers.provider} (${Object.keys(PROVIDERS).join(', ')})\n`
    );
    return 1;
  }
  const done = [];
  fs.writeFileSync(path.join(rootDir, 'vyntra.config.js'), configOf(answers));
  done.push('wrote vyntra.config.js');
  answers.kinds.forEach((kind) => {
    const [file, source] = EXAMPLES[kind];
    if (!exists(rootDir, file) || values.force) {
      fs.mkdirSync(path.dirname(path.join(rootDir, file)), { recursive: true });
      fs.writeFileSync(path.join(rootDir, file), source);
      done.push(`wrote ${file}`);
    }
  });
  const skill = { lines: [] };
  installSkill(['--agents', ...(values.force ? ['--force'] : [])], rootDir, {
    write: (text) => skill.lines.push(text),
  });
  done.push(
    ...skill.lines
      .join('')
      .trim()
      .split('\n')
      .filter((line) => !line.startsWith('For an MCP client'))
  );
  done.push(...[addMcp(rootDir), addGitignore(rootDir), addScript(rootDir)].filter(Boolean));
  const { add, exec } = installer(rootDir);
  const packages = [
    'vyntra',
    '@vyntra/mcp',
    ...(answers.kinds.includes('e2e') || answers.kinds.includes('ai') ? ['@vyntra/web', 'playwright'] : []),
    ...(answers.kinds.includes('ai') ? ['@vyntra/ai'] : []),
  ];
  const next = [`${add} ${packages.join(' ')}`];
  if (packages.includes('playwright')) {
    next.push(`${exec} playwright install chromium`);
  }
  if (answers.kinds.includes('ai')) {
    next.push(
      `export ${PROVIDERS[answers.provider].key}=...   (then ${exec} vyntra records the AI steps; commit vyntra.ai-cache/)`
    );
  }
  next.push(`${exec} vyntra`);
  out.write(
    `${done.map((line) => `  ${line.replace(/\.$/, '')}`).join('\n')}\n\nNext:\n${next.map((line) => `  ${line}`).join('\n')}\n`
  );
  return 0;
}

module.exports = { wizard, USAGE };
