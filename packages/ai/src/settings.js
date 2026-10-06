const Module = require('node:module');
const path = require('node:path');
const { projectConfig } = require('vyntra/engine');
const { AnthropicProvider } = require('./providers/anthropic');
const { OpenAIProvider } = require('./providers/openai');

const MODES = ['replay', 'record', 'live', 'off'];

// The providers vyntra knows by name: how to make one, and the model asked when use.ai.model is not set. Keys come
// from the environment, never from the config.
const BUILT_IN = {
  anthropic: { model: 'claude-opus-5-5', create: () => new AnthropicProvider() },
  // Claude, and most other models, through OpenRouter's OpenAI-compatible API. Without use.ai.model, the model is the
  // default of the OpenRouter account.
  openrouter: {
    model: null,
    optionalModel: true,
    create: (ai) =>
      new OpenAIProvider({
        name: 'openrouter',
        baseURL: ai.baseURL ?? 'https://openrouter.ai/api/v1',
        apiKey: process.env.OPENROUTER_API_KEY,
        headers: { 'x-title': 'vyntra' },
        reasoning: 'openrouter',
      }),
  },
  // OpenAI, or any host of its API (use.ai.baseURL or OPENAI_BASE_URL): Ollama and other local servers too.
  openai: {
    model: null,
    create: (ai) =>
      new OpenAIProvider({
        name: 'openai',
        baseURL: ai.baseURL ?? process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1',
        apiKey: process.env.OPENAI_API_KEY,
      }),
  },
};

// One provider per worker and per name: its client keeps its connections.
const providers = new Map();

// use.ai.provider: 'anthropic' (the default), 'openrouter', 'openai', or a module of the project's (a path or a
// package) exporting a provider: an object with name and complete(), or a class of one. A module, as the config
// reaches workers without functions.
function providerOf(ai, rootDir) {
  const { provider = 'anthropic' } = ai;
  if (typeof provider?.complete === 'function') {
    return provider;
  }
  if (typeof provider !== 'string') {
    throw new Error(
      `use.ai.provider is ${Object.keys(BUILT_IN).join(', ')}, or the path of a module exporting a provider`
    );
  }
  const id = `${provider} ${ai.baseURL ?? ''}`;
  if (!providers.has(id)) {
    let instance;
    if (Object.hasOwn(BUILT_IN, provider)) {
      instance = BUILT_IN[provider].create(ai);
    } else {
      const local = provider.startsWith('.') ? path.resolve(rootDir, provider) : provider;
      const exported = Module.createRequire(path.join(rootDir, 'package.json'))(local);
      const Found = exported?.default ?? exported;
      instance = typeof Found === 'function' ? new Found() : Found;
      if (typeof instance?.complete !== 'function') {
        throw new Error(`use.ai.provider ${provider} exports no provider (an object with a complete() method)`);
      }
    }
    providers.set(id, instance);
  }
  return providers.get(id);
}

function modelOf(ai) {
  const builtIn = BUILT_IN[ai.provider ?? 'anthropic'];
  const model = ai.model ?? (builtIn ? builtIn.model : null);
  if (!model && builtIn && !builtIn.optionalModel) {
    throw new Error(`use.ai.model: the ${ai.provider} provider has no default model`);
  }
  return model;
}

// A model other than the acting one: a name on the same provider, or { provider, model, effort, baseURL }.
function modelSettingsOf(given, ai, rootDir) {
  if (given === undefined) {
    return null;
  }
  const other = typeof given === 'string' ? { model: given } : given;
  const options = { ...ai, ...other, provider: other.provider ?? ai.provider, baseURL: other.baseURL ?? ai.baseURL };
  return {
    provider: providerOf(options, rootDir),
    model: modelOf(options),
    effort: other.effort ?? ai.effort ?? 'medium',
  };
}

// use.ai.judge: the model for judgments (assert, waitFor, extract, toSatisfy), when it is not the one that acts. A
// model name on the same provider, or { provider, model, effort, baseURL }; VYNTRA_AI_JUDGE_MODEL names one too. A
// cheap model can act while a strong one judges.
function judgeOf(ai, rootDir) {
  return modelSettingsOf(ai.judge ?? (process.env.VYNTRA_AI_JUDGE_MODEL || undefined), ai, rootDir);
}

// use.ai.vision: the model for the calls that carry a screenshot, when the acting or judging one reads no images.
// The same forms as judge; VYNTRA_AI_VISION_MODEL names one too.
function visionOf(ai, rootDir) {
  return modelSettingsOf(ai.vision ?? (process.env.VYNTRA_AI_VISION_MODEL || undefined), ai, rootDir);
}

const MAX_TEXT = 16_384;

// A text option, at most 16 KiB: it goes with every model call.
function limited(option, text) {
  if (text === undefined || text === null || text === '') {
    return '';
  }
  if (typeof text !== 'string' || Buffer.byteLength(text) > MAX_TEXT) {
    throw new Error(`${option} is text of at most ${MAX_TEXT} bytes`);
  }
  return text;
}

// The options of the AI steps, from the project's use.ai, the environment and the run: --ai <mode> wins over
// use.ai.mode; without either, CI replays what was recorded and a developer's machine records what is missing.
// `where`: the project's rootDir and outputDir, given outside a test run (vyntra explore).
function settingsOf(options = projectConfig().use.ai ?? {}, where = projectConfig()) {
  const { rootDir, outputDir } = where;
  // The provider and the model may come from the environment (VYNTRA_AI_PROVIDER, VYNTRA_AI_MODEL), so a machine or a
  // CI job chooses them without a config change; use.ai wins over them.
  const ai = {
    ...options,
    provider: options.provider ?? (process.env.VYNTRA_AI_PROVIDER || undefined),
    model: options.model ?? (process.env.VYNTRA_AI_MODEL || undefined),
  };
  const mode = process.env.VYNTRA_AI_MODE || ai.mode || (process.env.CI ? 'replay' : 'record');
  if (!MODES.includes(mode)) {
    throw new Error(`The AI mode is ${mode}: ${MODES.join(', ')}`);
  }
  return {
    mode,
    provider: providerOf(ai, rootDir),
    model: modelOf(ai),
    effort: ai.effort ?? 'medium',
    cacheDir: path.resolve(rootDir, ai.cacheDir ?? 'vyntra.ai-cache'),
    rootDir,
    // Model calls and tokens a whole run may spend, over all its workers.
    budget: { calls: 200, tokens: 2_000_000, ...ai.budget },
    usageFile: path.join(outputDir, 'ai-usage.jsonl'),
    traceFile: path.join(outputDir, 'ai-trace.jsonl'),
    // The model that judges, when it is not the one that acts.
    judge: judgeOf(ai, rootDir),
    vision: visionOf(ai, rootDir),
    // The app's vocabulary for every model call, and instructions for the acting agent only.
    context: limited('use.ai.context', ai.context),
    system: limited('use.ai.system', ai.system),
    // Actions an agent may take for one goal, and how long one may wait for its target.
    maxSteps: ai.maxSteps ?? 25,
    // After an action, what changed on the page rather than the whole page (false: the whole page every time).
    diffs: ai.diffs ?? process.env.VYNTRA_AI_DIFFS !== '0',
    actionTimeout: ai.actionTimeout ?? 5_000,
  };
}

module.exports = { settingsOf, MODES };
