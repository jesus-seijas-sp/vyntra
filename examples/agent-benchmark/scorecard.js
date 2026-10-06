const fs = require('node:fs');
const path = require('node:path');
const { scenarios } = require('./scenarios');

// The scorecard of the last agent run, from .vyntra/report.json: each scenario passed or failed, with why, and the
// score. Written to .vyntra/scorecard.md and printed.
const report = JSON.parse(fs.readFileSync(path.join(__dirname, '.vyntra', 'report.json'), 'utf8'));
const results = new Map(
  report.files
    .filter((file) => file.project === 'agent')
    .flatMap((file) => file.tests.map((test) => [test.path.at(-1).split(':')[0], test]))
);
const rows = scenarios.map(({ slug, name, surface }) => {
  const test = results.get(slug);
  const status = test?.status ?? 'not run';
  const why = test?.errors?.[0]?.message.split('\n').find((line) => line.trim()) ?? '';
  return `| ${status === 'passed' ? '✓' : '×'} | ${name} | ${surface} | ${status === 'passed' ? '' : why.replace(/\|/g, '/').slice(0, 160)} |`;
});
const passed = scenarios.filter(({ slug }) => results.get(slug)?.status === 'passed').length;
const engines = report.engines ? Object.values(report.engines)[0] : null;
const lines = [
  `# Agent benchmark: ${passed} of ${scenarios.length}`,
  '',
  engines ? `${engines.calls} model calls, ${engines.tokens} tokens, ${engines.models.join(', ')}` : '',
  '',
  '| | Scenario | Surface | Why it failed |',
  '| --- | --- | --- | --- |',
  ...rows,
  '',
];
fs.writeFileSync(path.join(__dirname, '.vyntra', 'scorecard.md'), lines.join('\n'));
process.stdout.write(lines.join('\n'));
