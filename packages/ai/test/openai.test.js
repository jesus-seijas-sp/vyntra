const { toChat, OpenAIProvider } = require('../src/providers/openai');

describe('the OpenAI-compatible provider', () => {
  it('turns tool calls and their results into Chat Completions messages', () => {
    const messages = [
      { role: 'user', content: 'Goal: add a todo' },
      {
        role: 'assistant',
        content: [{ type: 'tool_use', id: 'c1', name: 'click', input: { target: { role: 'button' } } }],
      },
      {
        role: 'user',
        content: [
          { type: 'tool_result', tool_use_id: 'c1', content: 'Timeout', is_error: true },
          { type: 'text', text: 'The page now: ...' },
        ],
      },
    ];
    expect(toChat('Be brief', messages)).toEqual([
      { role: 'system', content: 'Be brief' },
      { role: 'user', content: 'Goal: add a todo' },
      {
        role: 'assistant',
        content: null,
        tool_calls: [
          { id: 'c1', type: 'function', function: { name: 'click', arguments: '{"target":{"role":"button"}}' } },
        ],
      },
      { role: 'tool', tool_call_id: 'c1', content: 'Error: Timeout' },
      { role: 'user', content: 'The page now: ...' },
    ]);
  });

  it('keeps its own answers as they came, for the next turn', () => {
    const own = {
      role: 'assistant',
      content: null,
      reasoning_details: [{ type: 'reasoning.encrypted', data: 'x' }],
      tool_calls: [{ id: 'c2', type: 'function', function: { name: 'done', arguments: '{"summary":"ok"}' } }],
    };
    const completion = OpenAIProvider.completion({
      model: 'anthropic/claude-opus-5.5',
      choices: [{ finish_reason: 'tool_calls', message: own }],
      usage: { prompt_tokens: 50, completion_tokens: 5 },
    });
    expect(completion.toolCalls).toEqual([{ id: 'c2', name: 'done', input: { summary: 'ok' } }]);
    expect(completion.model).toBe('anthropic/claude-opus-5.5');
    expect(completion.usage).toEqual({ inputTokens: 50, outputTokens: 5 });
    expect(toChat(null, [completion.message])).toEqual([own]);
  });

  it('reads a JSON answer, and fails one that was cut off', () => {
    const answer = (finish, content) => ({
      choices: [{ finish_reason: finish, message: { role: 'assistant', content } }],
    });
    expect(OpenAIProvider.completion(answer('stop', '{"pass":true,"reasoning":"r"}')).json).toEqual({
      pass: true,
      reasoning: 'r',
    });
    expect(() => OpenAIProvider.completion(answer('length', '{"pass"'))).toThrow('cut off');
  });
});
