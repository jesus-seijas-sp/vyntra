const { EnvironmentError } = require('vyntra/engine');

const MAX_TOKENS = 16_000;

// The Anthropic SDK, loaded when the first model call is made: a run that replays makes none.
// eslint-disable-next-line global-require -- only what calls a model loads it
const sdk = () => require('@anthropic-ai/sdk');

// The credentials come from the environment, never from the config: ANTHROPIC_API_KEY, or CLAUDE_API_KEY. Neither set,
// the SDK looks for its other sources (ANTHROPIC_AUTH_TOKEN, an `ant auth login` profile). A key of the organization,
// not of a workspace, names the workspace to use in ANTHROPIC_WORKSPACE_ID.
const apiKeyFromEnv = () => process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY || undefined;
const workspaceFromEnv = () => process.env.ANTHROPIC_WORKSPACE_ID || undefined;

// The provider of Claude models. complete() is one model turn: messages in, the model's message out. Messages are in
// the Messages API's shape (content blocks of text, tool_use and tool_result), which other providers translate.
class AnthropicProvider {
  #client;

  #options;

  constructor(options = {}) {
    this.name = 'anthropic';
    this.#options = options;
    this.#client = options.client;
  }

  get client() {
    if (!this.#client) {
      const Anthropic = sdk().default;
      const { apiKey = apiKeyFromEnv(), baseURL, workspaceId = workspaceFromEnv() } = this.#options;
      const defaultHeaders = workspaceId ? { 'anthropic-workspace-id': workspaceId } : undefined;
      try {
        this.#client = new Anthropic({ apiKey, baseURL, defaultHeaders });
      } catch (error) {
        throw new EnvironmentError(
          `There are no credentials for Claude: set ANTHROPIC_API_KEY (or record the AI steps where they are set)`,
          { cause: error }
        );
      }
    }
    return this.#client;
  }

  // { model, system, messages, tools: [{ name, description, inputSchema }], schema, effort, signal } -> { message,
  // text, json, toolCalls: [{ id, name, input }], stopReason, usage: { inputTokens, outputTokens } }. A JSON schema
  // makes the answer JSON of that shape (json).
  async complete({ model, system, messages, tools, schema, effort, signal }) {
    const outputConfig = {
      ...(effort ? { effort } : {}),
      ...(schema ? { format: { type: 'json_schema', schema } } : {}),
    };
    let response;
    try {
      response = await this.client.beta.messages.create(
        {
          model,
          max_tokens: MAX_TOKENS,
          ...(system ? { system } : {}),
          messages,
          ...(tools?.length > 0
            ? {
                tools: tools.map((tool) => ({
                  name: tool.name,
                  description: tool.description,
                  input_schema: tool.inputSchema,
                  strict: true,
                })),
              }
            : {}),
          ...(Object.keys(outputConfig).length > 0 ? { output_config: outputConfig } : {}),
          // A request a safety classifier declines is run again on the model Anthropic recommends for it.
          betas: ['server-side-fallback-2026-07-01'],
          fallbacks: 'default',
        },
        { signal }
      );
    } catch (error) {
      throw AnthropicProvider.problem(error);
    }
    return AnthropicProvider.completion(response);
  }

  // An error of the API or the SDK (credentials, rate limits after the retries, an outage) is the environment's: exit
  // code 3. A request the test aborted (it timed out) is not.
  static problem(error) {
    const { AnthropicError, APIUserAbortError } = sdk();
    if (error instanceof APIUserAbortError || !(error instanceof AnthropicError)) {
      return error;
    }
    const status = error.status ? ` (${error.status})` : '';
    return new EnvironmentError(`Claude did not answer${status}: ${error.message}`, { cause: error });
  }

  static completion(response) {
    const text = response.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('');
    const toolCalls = response.content
      .filter((block) => block.type === 'tool_use')
      .map(({ id, name, input }) => ({ id, name, input }));
    if (response.stop_reason === 'refusal') {
      const category = response.stop_details?.category;
      throw new Error(`Claude declined the request${category ? ` (${category})` : ''}`);
    }
    if (response.stop_reason === 'max_tokens') {
      throw new Error(`Claude's answer was cut off at ${MAX_TOKENS} tokens`);
    }
    return {
      // The whole content goes back in the next turn, thinking blocks included.
      message: { role: 'assistant', content: response.content },
      text,
      json: AnthropicProvider.parse(text),
      toolCalls,
      stopReason: response.stop_reason,
      model: response.model,
      usage: {
        inputTokens:
          (response.usage?.input_tokens ?? 0) +
          (response.usage?.cache_read_input_tokens ?? 0) +
          (response.usage?.cache_creation_input_tokens ?? 0),
        outputTokens: response.usage?.output_tokens ?? 0,
      },
    };
  }

  static parse(text) {
    try {
      return JSON.parse(text);
    } catch {
      return undefined;
    }
  }
}

module.exports = { AnthropicProvider };
