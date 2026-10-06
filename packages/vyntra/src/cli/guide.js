const fs = require('node:fs');
const path = require('node:path');

// `vyntra guide [topic]` and `vyntra init --agents`: the documentation that ships in the package, for people in a
// terminal and for coding agents, and the skill that tells agents how to use vyntra here.

const PACKAGE = path.join(__dirname, '..', '..');
const DOCS = path.join(PACKAGE, 'docs');
const SKILL = path.join(PACKAGE, 'agents', 'SKILL.md');

// Every topic: 'guide/projects', 'api/config'...
function topics() {
  return ['guide', 'api', 'migrating'].flatMap((dir) =>
    fs
      .readdirSync(path.join(DOCS, dir))
      .filter((file) => file.endsWith('.md'))
      .map((file) => `${dir}/${file.slice(0, -3)}`)
  );
}

// A topic from what was asked: its full name, its name alone ('projects', the guide's first), or the only one
// whose name contains it. Returns { topic } or { candidates }.
function findTopic(asked) {
  const all = topics();
  const wanted = asked.toLowerCase().replace(/\.md$/, '');
  if (all.includes(wanted)) {
    return { topic: wanted };
  }
  const named = all.filter((topic) => topic.split('/')[1] === wanted);
  if (named.length > 0) {
    return { topic: named[0] };
  }
  const containing = all.filter((topic) => topic.includes(wanted));
  return containing.length === 1 ? { topic: containing[0] } : { candidates: containing };
}

function guide(args, out = process.stdout) {
  const asked = args.filter((arg) => !arg.startsWith('-')).join(' ');
  if (!asked) {
    out.write(fs.readFileSync(path.join(DOCS, 'index.md'), 'utf8'));
    return 0;
  }
  const { topic, candidates } = findTopic(asked);
  if (topic) {
    out.write(fs.readFileSync(path.join(DOCS, `${topic}.md`), 'utf8'));
    return 0;
  }
  const hint = candidates.length > 0 ? `Did you mean ${candidates.join(', ')}?` : 'vyntra guide lists every topic.';
  process.stderr.write(`No topic "${asked}". ${hint}\n`);
  return 1;
}

// Writes the skill for coding agents into the project: .claude/skills/vyntra/SKILL.md, where Claude Code finds it
// (--dir puts it elsewhere). An existing one is kept unless --force.
function init(args, rootDir = process.cwd(), out = process.stdout) {
  if (!args.includes('--agents')) {
    process.stderr.write('vyntra init --agents writes the skill coding agents use to run and fix tests here\n');
    return 1;
  }
  const dirIndex = args.indexOf('--dir');
  const dir = dirIndex >= 0 && args[dirIndex + 1] ? args[dirIndex + 1] : path.join('.claude', 'skills', 'vyntra');
  const target = path.resolve(rootDir, dir, 'SKILL.md');
  const shown = path.relative(rootDir, target);
  if (fs.existsSync(target) && !args.includes('--force')) {
    process.stderr.write(`${shown} exists: --force replaces it\n`);
    return 1;
  }
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(SKILL, target);
  out.write(
    `Wrote ${shown}.\n` +
      'Agents that do not read skills can be pointed at it from AGENTS.md: "To run or fix tests, follow ' +
      `${shown}."\nFor an MCP client, add @vyntra/mcp: npx vyntra-mcp (see its README).\n`
  );
  return 0;
}

module.exports = { guide, init, findTopic, topics };
