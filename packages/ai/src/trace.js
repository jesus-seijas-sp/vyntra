const fs = require('node:fs');
const path = require('node:path');

// --ai-trace: every model call of the run's AI steps, one JSON line each in .vyntra/ai-trace.jsonl, for reading what
// an agent was shown and what it answered when a step goes wrong. The request is the one the model received, secret
// values hidden; nothing is sent anywhere.
const tracing = () => Boolean(process.env.VYNTRA_AI_TRACE);

function traceCall(file, entry) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, `${JSON.stringify(entry)}\n`);
}

// The trace's lines for one run.
function traced(file, run) {
  let text = '';
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    return [];
  }
  return text
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter((entry) => entry?.run === run);
}

module.exports = { tracing, traceCall, traced };
