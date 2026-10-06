const { setTimeout: sleep } = require('node:timers/promises');
const { EnvironmentError } = require('vyntra/engine');

const MAX_TOKENS = 16_000;
const RETRIES = 2;
const RETRY_MS = 1_000;

// Messages in the Messages API's shape (what steps keep) as Chat Completions messages. An assistant message this
// provider made carries its own message as it came (`openai_message`), reasoning details included, and goes back so.
function toChat(system, messages) {
  const chat = system ? [{ role: 'system', content: system }] : [];
  messages.forEach(({ role, content }) => {
    if (typeof content === 'string') {
      chat.push({ role, content });
      return;
    }
    const own = content.find((block) => block.type === 'openai_message');
    if (role === 'assistant' && own) {
      chat.push(own.message);
      return;
    }
    if (role === 'assistant') {
      const toolCalls = content.filter((block) => block.type === 'tool_use');
      chat.push({
        role,
        content:
          content
            .filter((block) => block.type === 'text')
            .map((block) => block.text)
            .join('') || null,
        ...(toolCalls.length > 0
          ? {
              tool_calls: toolCalls.map(({ id, name, input }) => ({
                id,
                type: 'function',
                function: { name, arguments: JSON.stringify(input) },
              })),
            }
          : {}),
      });
      return;
    }
    // A user turn: the results of the tools first, as tool messages, then its text.
    content
      .filter((block) => block.type === 'tool_result')
      .forEach((block) => {
        const text = typeof block.content === 'string' ? block.content : JSON.stringify(block.content);
        chat.push({ role: 'tool', tool_call_id: block.tool_use_id, content: block.is_error ? `Error: ${text}` : text });
      });
    const text = content.filter((block) => block.type === 'text').map((block) => block.text);
    const images = content.filter((block) => block.type === 'image' && block.source?.type === 'base64');
    if (images.length > 0) {
      // Text and images as parts, the images as data URLs.
      chat.push({
        role,
        content: [
          ...text.map((part) => ({ type: 'text', text: part })),
          ...images.map(({ source }) => ({
            type: 'image_url',
            image_url: { url: `data:${source.media_type};base64,${source.data}` },
          })),
        ],
      });
    } else if (text.length > 0) {
      chat.push({ role, content: text.join('\n\n') });
    }
  });
  return chat;
}

function parseArguments(text) {
  try {
    return JSON.parse(text || '{}');
  } catch {
    return {};
  }
}

const retryable = (status) => status === 408 || status === 429 || status >= 500;

// A provider of any host that speaks OpenAI's Chat Completions: OpenAI, OpenRouter, most hosts, Ollama and other
// local servers. complete() is one model turn, as for every provider.
class OpenAIProvider {
  #options;

  // { name, baseURL, apiKey, headers, reasoning: 'openrouter' | 'openai' | 'none' }
  constructor(options) {
    this.#options = options;
    this.name = options.name;
  }

  async complete({ model, system, messages, tools, schema, effort, signal }) {
    const { reasoning = 'openai' } = this.#options;
    const body = {
      // No model: the host's default (OpenRouter's, as its account sets it).
      ...(model ? { model } : {}),
      max_tokens: MAX_TOKENS,
      messages: toChat(system, messages),
      ...(tools?.length > 0
        ? {
            tools: tools.map((tool) => ({
              type: 'function',
              function: { name: tool.name, description: tool.description, parameters: tool.inputSchema, strict: true },
            })),
          }
        : {}),
      ...(schema
        ? { response_format: { type: 'json_schema', json_schema: { name: 'answer', strict: true, schema } } }
        : {}),
      ...(effort && reasoning === 'openrouter' ? { reasoning: { effort } } : {}),
      ...(effort && reasoning === 'openai' ? { reasoning_effort: effort } : {}),
    };
    const data = await this.post(body, signal);
    return OpenAIProvider.completion(data);
  }

  // The request, again after a rate limit or an error of the host (twice, a second and then two apart).
  async post(body, signal) {
    const { baseURL, apiKey, headers = {} } = this.#options;
    for (let attempt = 0; ; attempt += 1) {
      let response;
      try {
        // eslint-disable-next-line no-await-in-loop -- tried again only after the last attempt failed
        response = await fetch(`${baseURL.replace(/\/$/, '')}/chat/completions`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
            ...headers,
          },
          body: JSON.stringify(body),
          signal,
        });
      } catch (error) {
        if (error.name === 'AbortError' || attempt >= RETRIES) {
          throw error.name === 'AbortError'
            ? error
            : new EnvironmentError(`${this.name} did not answer: ${error.message}`, { cause: error });
        }
      }
      if (response?.ok) {
        // eslint-disable-next-line no-await-in-loop
        const data = await response.json();
        if (!data.error) {
          return data;
        }
        throw new EnvironmentError(`${this.name} answered with an error: ${JSON.stringify(data.error)}`);
      }
      if (response && (!retryable(response.status) || attempt >= RETRIES)) {
        // eslint-disable-next-line no-await-in-loop
        const text = await response.text().catch(() => '');
        throw new EnvironmentError(`${this.name} did not answer (${response.status}): ${text.slice(0, 1_000)}`);
      }
      // eslint-disable-next-line no-await-in-loop
      await sleep(RETRY_MS * 2 ** attempt, undefined, { signal });
    }
  }

  static completion(data) {
    const choice = data.choices?.[0];
    if (!choice) {
      throw new EnvironmentError(`The answer has no choices: ${JSON.stringify(data).slice(0, 500)}`);
    }
    if (choice.finish_reason === 'content_filter') {
      throw new Error('The model declined the request');
    }
    if (choice.finish_reason === 'length') {
      throw new Error(`The model's answer was cut off at ${MAX_TOKENS} tokens`);
    }
    const own = choice.message;
    const text = typeof own.content === 'string' ? own.content : '';
    const toolCalls = (own.tool_calls ?? []).map((call) => ({
      id: call.id,
      name: call.function.name,
      input: parseArguments(call.function.arguments),
    }));
    const content = [
      ...(text ? [{ type: 'text', text }] : []),
      ...toolCalls.map((call) => ({ type: 'tool_use', ...call })),
      { type: 'openai_message', message: { ...own, role: 'assistant' } },
    ];
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      json = undefined;
    }
    return {
      message: { role: 'assistant', content },
      text,
      json,
      toolCalls,
      stopReason: choice.finish_reason,
      model: data.model,
      usage: { inputTokens: data.usage?.prompt_tokens ?? 0, outputTokens: data.usage?.completion_tokens ?? 0 },
    };
  }
}

module.exports = { OpenAIProvider, toChat };
