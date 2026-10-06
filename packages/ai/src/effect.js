// What an act step changed on the page, kept with its recording so a replay can tell that it did the same: the route
// it ended on, and up to 8 lines of the accessibility tree that appeared and 8 that went away (alerts and status
// messages first). A replay whose actions all ran but whose page does not end that way did not reach the goal.

const MAX_ANCHORS = 8;

// Text that reads differently on every run says nothing about the step: a time, a date, a long number or id.
const VOLATILE = [
  /\b\d{1,2}:\d{2}\b/,
  /\b\d{4}-\d{2}-\d{2}\b/,
  /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/,
  /\d{5,}/,
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}/i,
  /\b[0-9a-f]{12,}\b/i,
  /\bago\b|\bjust now\b/i,
];

// The lines of an accessibility tree (Playwright's aria snapshot) that say something: a role with a name, a text or
// a state. Containers with nothing of their own (`- listitem:`) and link targets are left out.
function linesOf(tree) {
  return tree
    .split('\n')
    .map((line) => line.trim().replace(/^- /, '').replace(/:$/, ''))
    .filter((line) => line && !line.startsWith('/') && /["'[]|: /.test(line));
}

function counts(lines) {
  const map = new Map();
  lines.forEach((line) => map.set(line, (map.get(line) ?? 0) + 1));
  return map;
}

// Lines one tree has more of than the other.
const added = (from, to) => [...to.keys()].filter((line) => (to.get(line) ?? 0) > (from.get(line) ?? 0));

const notice = (line) => /^(alert|status)\b/.test(line);
const anchors = (lines) =>
  lines
    .filter((line) => !VOLATILE.some((pattern) => pattern.test(line)))
    .sort((a, b) => Number(notice(b)) - Number(notice(a)))
    .slice(0, MAX_ANCHORS);

// The effect of a step, from the page before it to the page after: { route, appeared, disappeared }, or null when the
// step changed nothing a replay could check (the same route, no line came or went).
function effectOf(before, after) {
  const from = counts(linesOf(before.tree));
  const to = counts(linesOf(after.tree));
  const appeared = anchors(added(from, to));
  const disappeared = anchors(added(to, from));
  if (appeared.length === 0 && disappeared.length === 0 && before.route === after.route) {
    return null;
  }
  return { route: after.route, appeared, disappeared };
}

// Why a replay did not reach the recorded effect, or null when it did. `start` is the page the replay began on, `end`
// the page after its actions. The effect must be there at the end, and some of it must have happened during the
// replay: an outcome already on the page before the actions proves nothing.
function mismatchOf(effect, start, end) {
  if (!effect) {
    return null;
  }
  if (end.route !== effect.route) {
    return `the page ended on ${end.route}, not ${effect.route}`;
  }
  const before = counts(linesOf(start.tree));
  const after = counts(linesOf(end.tree));
  const missing = effect.appeared.filter((line) => !after.has(line));
  if (missing.length > 0) {
    return `the page does not show ${JSON.stringify(missing[0])}`;
  }
  const remaining = effect.disappeared.filter((line) => after.has(line));
  if (remaining.length > 0) {
    return `the page still shows ${JSON.stringify(remaining[0])}`;
  }
  const happened =
    start.route !== end.route ||
    effect.appeared.some((line) => (after.get(line) ?? 0) > (before.get(line) ?? 0)) ||
    effect.disappeared.some((line) => (before.get(line) ?? 0) > (after.get(line) ?? 0));
  return happened ? null : 'the outcome was already on the page before the replay';
}

module.exports = { effectOf, mismatchOf, linesOf };
