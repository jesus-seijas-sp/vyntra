const path = require('node:path');
const { Budget } = require('./budget');
const { traced } = require('./trace');

const TRACED_STEPS = 10;

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

const seconds = (ms) => `${(ms / 1000).toFixed(1)}s`;
const clip = (text, length) => (text.length > length ? `${text.slice(0, length - 1)}…` : text);

// The traced steps of a run (--ai-trace), slowest first: where the trace is, and a line per step with its model
// calls, tokens and time.
function traceLines(rootDir, outputDir, run) {
  const file = path.join(outputDir, 'ai-trace.jsonl');
  const calls = traced(file, run);
  if (calls.length === 0) {
    return { lines: [], file: null };
  }
  const steps = new Map();
  calls.forEach((call) => {
    const id = JSON.stringify([call.file, call.test, call.step.kind, call.step.text]);
    const step = steps.get(id) ?? { ...call.step, calls: 0, tokens: 0, ms: 0 };
    step.calls += 1;
    step.tokens += (call.usage?.inputTokens ?? 0) + (call.usage?.outputTokens ?? 0);
    step.ms += call.ms;
    steps.set(id, step);
  });
  const shown = path.relative(rootDir, file).split(path.sep).join('/');
  const rows = [...steps.values()]
    .sort((a, b) => b.ms - a.ms)
    .slice(0, TRACED_STEPS)
    .map((step, i) => [
      i === 0 ? 'Steps' : '',
      `${clip(`${step.kind} "${step.text ?? ''}"`, 60)} · ${plural(step.calls, 'call')} · ${compact(step.tokens)} tokens · ${seconds(step.ms)}`,
    ]);
  return { lines: [['AI trace', `${shown} · ${plural(calls.length, 'model call')}`], ...rows], file: shown };
}

// What the AI steps of a run cost and how the replay cache served them, for the run's summary and report.json:
// { lines: [label, text], data }, or null when the run had no AI step. The core calls it once the run ended.
function summarize({ rootDir, outputDir, runId }) {
  const run = runId ?? `${process.pid}`;
  const entries = Budget.entries(path.join(outputDir, 'ai-usage.jsonl'), run);
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
  const trace = traceLines(rootDir, outputDir, run);
  lines.push(...trace.lines);
  return {
    lines,
    data: {
      calls: calls.length,
      tokens: sum('tokens'),
      input: sum('input'),
      output: sum('output'),
      models,
      steps,
      ...(trace.file ? { trace: trace.file } : {}),
    },
  };
}

module.exports = { summarize };
