// What changed on a page between two reads, as a unified diff of their text (address, title, accessibility tree):
// after an action the agent gets the lines that came and went with two lines around each change, rather than the
// whole page again. The whole page is better when most of it changed, or when the lines are too many to compare.

const CONTEXT = 2;
const MAX_CELLS = 4_000_000;
// Above this share of the page's lines changed, the page itself reads better than its diff.
const MAX_CHANGED = 0.5;

// The longest common subsequence of two line lists, as the pairs of indexes it keeps.
function common(before, after) {
  const rows = before.length + 1;
  const columns = after.length + 1;
  const lengths = new Uint32Array(rows * columns);
  for (let i = before.length - 1; i >= 0; i -= 1) {
    for (let j = after.length - 1; j >= 0; j -= 1) {
      lengths[i * columns + j] =
        before[i] === after[j]
          ? lengths[(i + 1) * columns + j + 1] + 1
          : Math.max(lengths[(i + 1) * columns + j], lengths[i * columns + j + 1]);
    }
  }
  const pairs = [];
  let i = 0;
  let j = 0;
  while (i < before.length && j < after.length) {
    if (before[i] === after[j]) {
      pairs.push([i, j]);
      i += 1;
      j += 1;
    } else if (lengths[(i + 1) * columns + j] >= lengths[i * columns + j + 1]) {
      i += 1;
    } else {
      j += 1;
    }
  }
  return pairs;
}

// The diff of two texts, line by line: { text, changed } with changed the share of lines that differ, or null when
// they can not be compared cheaply. text is empty when nothing changed.
function diffOf(beforeText, afterText) {
  const before = beforeText.split('\n');
  const after = afterText.split('\n');
  if (before.length * after.length > MAX_CELLS) {
    return null;
  }
  const pairs = common(before, after);
  // Every line as kept (' '), gone ('-') or new ('+'), in order.
  const lines = [];
  let i = 0;
  let j = 0;
  [...pairs, [before.length, after.length]].forEach(([keptBefore, keptAfter]) => {
    for (; i < keptBefore; i += 1) {
      lines.push(['-', before[i]]);
    }
    for (; j < keptAfter; j += 1) {
      lines.push(['+', after[j]]);
    }
    if (keptBefore < before.length) {
      lines.push([' ', before[keptBefore]]);
      i += 1;
      j += 1;
    }
  });
  const changes = lines.filter(([mark]) => mark !== ' ').length;
  if (changes === 0) {
    return { text: '', changed: 0 };
  }
  // The changed lines and two kept ones around each run of them; "..." where kept lines are left out.
  const near = (index) => lines.slice(Math.max(0, index - CONTEXT), index + CONTEXT + 1).some(([mark]) => mark !== ' ');
  const shown = [];
  let skipped = false;
  lines.forEach(([mark, line], index) => {
    if (mark !== ' ' || near(index)) {
      if (skipped) {
        shown.push('  ...');
        skipped = false;
      }
      shown.push(`${mark} ${line}`);
    } else {
      skipped = true;
    }
  });
  return { text: shown.join('\n'), changed: changes / Math.max(before.length, after.length) };
}

// What the agent is told of the page after its action: the diff against what it last saw, or the whole page.
function pageUpdate(seen, now) {
  const diff = seen ? diffOf(seen, now) : null;
  if (!diff || diff.changed > MAX_CHANGED) {
    return { whole: true, text: now };
  }
  return { whole: false, text: diff.text || '(nothing changed)' };
}

module.exports = { diffOf, pageUpdate };
