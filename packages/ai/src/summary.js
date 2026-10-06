const path = require('node:path');
const { Budget } = require('./budget');

// k and M for token counts: 12.3k, 1.2M.
function compact(count) {
  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(1)}M`;
  }
  if (count >= 1_000) {
    return `${(count / 1_000).toFixed(1)}k`;
  }
  return String(count);
}

const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`;

// What the AI steps of a run cost and how the replay cache served them, for the run's summary and report.json:
// { lines: [label, text], data }, or null when the run had no AI step. The core calls it once the run ended.
function summarize({ outputDir, runId }) {
  const entries = Budget.entries(path.join(outputDir, 'ai-usage.jsonl'), runId ?? `${process.pid}`);
  if (entries.length === 0) {
    return null;
  }
  const calls = entries.filter((entry) => entry.tokens !== undefined);
  const sum = (field) => calls.reduce((total, entry) => total + (entry[field] ?? 0), 0);
  const models = [...new Set(calls.map((entry) => entry.model).filter(Boolean))].sort();
  const steps = { replayed: 0, 'handed-off': 0, missed: 0 };
  entries
    .filter((entry) => entry.step)
    .forEach((entry) => {
      steps[entry.step] = (steps[entry.step] ?? 0) + 1;
    });
  const usage =
    calls.length > 0
      ? [`${compact(sum('tokens'))} tokens`, plural(calls.length, 'model call'), ...models].join(' · ')
      : 'no model calls';
  const lines = [['AI', usage]];
  if (Object.values(steps).some((count) => count > 0)) {
    lines.push(['Cache', `${steps.replayed} replayed · ${steps['handed-off']} handed off · ${steps.missed} missed`]);
  }
  return {
    lines,
    data: { calls: calls.length, tokens: sum('tokens'), input: sum('input'), output: sum('output'), models, steps },
  };
}

module.exports = { summarize };
