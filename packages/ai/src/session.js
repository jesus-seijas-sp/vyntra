const crypto = require('node:crypto');
const path = require('node:path');
const { currentTest, ReplayCache, SkipError, redact } = require('vyntra/engine');
const { settingsOf } = require('./settings');
const { Budget } = require('./budget');

// Bumped when the prompts change what a model would answer: every recorded result is then a miss.
const PROMPT_VERSION = 4;
const KEPT_TURNS = 6;
const MAX_TURN_TEXT = 4_000;

// A value with every secret value it holds hidden: the last guard before a model, a recording or a failure page.
const hidden = (value) => JSON.parse(redact(JSON.stringify(value)));

const clip = (text) => (text.length > MAX_TURN_TEXT ? `${text.slice(0, MAX_TURN_TEXT)}\n… (cut)` : text);

// A turn as the failure page shows it.
function describeTurn({ role, content }) {
  const blocks = typeof content === 'string' ? [{ type: 'text', text: content }] : content;
  const parts = blocks.flatMap((block) => {
    if (block.type === 'text') {
      return [block.text];
    }
    if (block.type === 'tool_use') {
      return [`→ ${block.name} ${JSON.stringify(block.input)}`];
    }
    if (block.type === 'tool_result') {
      const text = typeof block.content === 'string' ? block.content : JSON.stringify(block.content);
      return [`${block.is_error ? '✗' : '←'} ${text}`];
    }
    return [];
  });
  return `[${role}]\n${clip(parts.join('\n'))}`;
}

// The AI steps of one test: where their results are recorded, what they may spend, and what the failure page shows
// of them. A step is made once and its result reused until its input changes; the key of a result is a hash of the
// step, its input, the model and the prompts.
class AiSession {
  // context: what the test adds to the project's vocabulary (agent.addContext).
  constructor(settings = settingsOf(), test = currentTest(), { context = [] } = {}) {
    if (!test) {
      throw new Error('AI steps run inside a test');
    }
    this.settings = settings;
    // What the app calls things, read by every model call; secret values hidden, as everything sent.
    this.context = redact([settings.context, ...context].filter(Boolean).join('\n\n'));
    this.test = test;
    this.cache = ReplayCache.forTest(settings.cacheDir, settings.rootDir, test.file, test.titlePath);
    this.budget = new Budget(settings.budget, settings.usageFile);
  }

  get mode() {
    return this.settings.mode;
  }

  // Under --ai off, a test with AI steps is skipped at its first one.
  checkEnabled() {
    if (this.mode === 'off') {
      throw new SkipError('AI steps are off');
    }
  }

  keyOf({ kind, text, input }) {
    const { model, provider } = this.settings;
    // No model set: the provider's own default (OpenRouter's), which the key can not know.
    // A step judged or driven with other vocabulary is another step: the context counts, when there is one.
    const vocabulary = this.context ? [crypto.createHash('sha256').update(this.context).digest('hex')] : [];
    const identity = JSON.stringify([
      PROMPT_VERSION,
      provider.name,
      model ?? 'default',
      kind,
      text,
      input,
      ...vocabulary,
    ]);
    return crypto.createHash('sha256').update(identity).digest('hex').slice(0, 24);
  }

  // A system prompt with the project's words: the app's vocabulary (context) for every model call, and the project's
  // instructions (use.ai.system) for the agent that acts only. A judge never reads them: instructions such as "a step
  // is done once the form closes" would lower its bar.
  systemFor(base, { acting = false } = {}) {
    const parts = [base];
    if (this.context) {
      parts.push(`About the app under test, from the project (trusted):\n${this.context}`);
    }
    if (acting && this.settings.system) {
      parts.push(`Instructions from the project:\n${this.settings.system}`);
    }
    return parts.join('\n\n');
  }

  // The model that answered last, or the one asked: the provider's default model is known once it answered.
  get modelName() {
    return this.answeredBy ?? this.settings.model ?? `${this.settings.provider.name}'s default model`;
  }

  // A recorded result of the step, unless the mode ignores them (live).
  recorded(key) {
    return this.mode === 'live' ? undefined : this.cache.get(key);
  }

  // Records the result of a step, replacing what was recorded for the same step on another input.
  record(key, { kind, text }, result) {
    if (this.mode === 'live') {
      return;
    }
    this.cache.set(
      key,
      hidden({ kind, text, model: this.modelName, ...result }),
      (old) => old.kind === kind && old.text === text
    );
  }

  // Drops a recording that a failed test can no longer vouch for.
  forget(key) {
    if (this.mode !== 'live') {
      this.cache.delete(key);
    }
  }

  // A step that is not recorded, in replay mode: the step fails, and says how to record it.
  missing({ kind, text }) {
    const act =
      kind === 'act'
        ? ' An act is recorded only when a later check in the test passes: follow it with an assertion on the page or agent.assert.'
        : '';
    return new Error(
      `No recorded result for ${kind} "${text}" on this input (AI mode: replay). ` +
        `Record it where a model can be called (vyntra --ai record) and commit ${this.cacheFile}.${act}`
    );
  }

  get cacheFile() {
    return path.relative(this.settings.rootDir, this.cache.file).split(path.sep).join('/');
  }

  // One model turn, within the run's budget.
  async call(request) {
    this.budget.check();
    const { model, effort, provider } = this.settings;
    const completion = await provider.complete({ model, effort, signal: this.test.signal, ...hidden(request) });
    this.budget.add(completion.usage);
    this.answeredBy = completion.model;
    return completion;
  }

  // What the failure page shows of a step: where its result came from, the result, and its last turns.
  attach(name, { source, summary, turns = [] }) {
    const shown = turns.slice(-KEPT_TURNS).map(describeTurn);
    const body = [`(${source})`, summary, ...(shown.length > 0 ? ['', ...shown] : [])].join('\n');
    this.test.attach(redact(`AI ${name}`), { body: redact(body) });
  }
}

module.exports = { AiSession, PROMPT_VERSION };
