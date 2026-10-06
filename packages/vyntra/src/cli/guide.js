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

// Links a skill directory where another agent looks for it (.claude/skills/vyntra to .agents/skills/vyntra): one copy
// for every agent. A junction on Windows, where a directory symlink needs privileges; a copy when neither works. A
// directory of the project's own there (an older copy it may have changed) is left alone unless `force`; a link is
// only unlinked, never followed.
function linkSkill(from, to, force) {
  const there = fs.lstatSync(to, { throwIfNoEntry: false });
  if (there?.isSymbolicLink()) {
    fs.unlinkSync(to);
  } else if (there && !force) {
    return 'kept';
  } else if (there) {
    fs.rmSync(to, { recursive: true });
  }
  fs.mkdirSync(path.dirname(to), { recursive: true });
  try {
    fs.symlinkSync(process.platform === 'win32' ? from : path.relative(path.dirname(to), from), to, 'junction');
    return 'linked';
  } catch {
    fs.cpSync(from, to, { recursive: true });
    return 'copied';
  }
}

// AGENTS.md, when the project has one, points at the skill: agents that read no skills follow it from there.
function pointAgents(rootDir, skill) {
  const file = path.join(rootDir, 'AGENTS.md');
  if (!fs.existsSync(file)) {
    return false;
  }
  const text = fs.readFileSync(file, 'utf8');
  if (text.includes(skill)) {
    return false;
  }
  const line = `Tests run with vyntra: read ${skill} before writing, running or fixing one.`;
  const separator = text === '' || text.endsWith('\n') ? '' : '\n';
  fs.appendFileSync(file, `${separator}\n${line}\n`);
  return true;
}

// vyntra init --agents: the skill for coding agents, in .agents/skills/vyntra (read by agents that follow that
// layout), linked from .claude/skills/vyntra (Claude Code), and named in AGENTS.md when there is one. --dir writes one
// copy there instead; --force replaces one that is there.
function init(args, rootDir = process.cwd(), out = process.stdout) {
  if (!args.includes('--agents')) {
    process.stderr.write('vyntra init --agents writes the skill coding agents use to run and fix tests here\n');
    return 1;
  }
  const dirIndex = args.indexOf('--dir');
  const own = dirIndex >= 0 ? args[dirIndex + 1] : undefined;
  const dir = own || path.join('.agents', 'skills', 'vyntra');
  const target = path.resolve(rootDir, dir, 'SKILL.md');
  const shown = path.relative(rootDir, target);
  if (fs.existsSync(target) && !args.includes('--force')) {
    process.stderr.write(`${shown} exists: --force replaces it\n`);
    return 1;
  }
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(SKILL, target);
  const lines = [`Wrote ${shown}.`];
  if (!own) {
    const claude = path.join('.claude', 'skills', 'vyntra');
    const how = linkSkill(path.dirname(target), path.resolve(rootDir, claude), args.includes('--force'));
    const said = {
      linked: `Linked ${claude} to it, for Claude Code.`,
      copied: `Copied it to ${claude}, for Claude Code.`,
      kept: `Left ${claude} as it is: --force replaces it with a link.`,
    };
    lines.push(said[how]);
  }
  const posix = shown.split(path.sep).join('/');
  if (pointAgents(rootDir, posix)) {
    lines.push('Pointed AGENTS.md at it.');
  } else if (!fs.existsSync(path.join(rootDir, 'AGENTS.md'))) {
    lines.push(
      `Agents that read no skills can be pointed at it from AGENTS.md: "Tests run with vyntra: read ${posix}."`
    );
  }
  lines.push('For an MCP client, add @vyntra/mcp: npx vyntra-mcp (see its README).');
  out.write(`${lines.join('\n')}\n`);
  return 0;
}

module.exports = { guide, init, findTopic, topics };
