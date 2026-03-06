import { describe, it, expect, vi } from 'vitest';
import type Anthropic from '@anthropic-ai/sdk';
import type OpenAI from 'openai';
import {
  convertToolsToOpenAI,
  convertMessagesToOpenAI,
  convertOpenAIResponseToAnthropic,
  safeParseJSON,
} from '../openai-adapter';

describe('safeParseJSON', () => {
  it('parses valid JSON', () => {
    expect(safeParseJSON('{"a":1}')).toEqual({ a: 1 });
  });

  it('returns fallback for invalid JSON', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = safeParseJSON('not valid {{{');
    expect(result).toEqual({ _raw: 'not valid {{{' });
    spy.mockRestore();
  });
});

describe('convertToolsToOpenAI', () => {
  it('converts Anthropic tools to OpenAI function tools', () => {
    const tools: Anthropic.Tool[] = [
      {
        name: 'web_search',
        description: 'Search the web',
        input_schema: {
          type: 'object' as const,
          properties: { query: { type: 'string' } },
          required: ['query'],
        },
      },
    ];

    const result = convertToolsToOpenAI(tools);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('function');
    const fn = result[0] as { type: 'function'; function: { name: string; description: string; parameters: unknown } };
    expect(fn.function.name).toBe('web_search');
    expect(fn.function.description).toBe('Search the web');
    expect(fn.function.parameters).toEqual(tools[0].input_schema);
  });

  it('returns empty array for no tools', () => {
    expect(convertToolsToOpenAI([])).toEqual([]);
  });
});

describe('convertMessagesToOpenAI', () => {
  it('prepends system prompt as system message', () => {
    const result = convertMessagesToOpenAI('You are helpful', []);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ role: 'system', content: 'You are helpful' });
  });

  it('skips system message when empty', () => {
    const result = convertMessagesToOpenAI('', [
      { role: 'user', content: 'hi' },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ role: 'user', content: 'hi' });
  });

  it('converts string user messages', () => {
    const result = convertMessagesToOpenAI('', [
      { role: 'user', content: 'hello' },
    ]);
    expect(result[0]).toEqual({ role: 'user', content: 'hello' });
  });

  it('converts string assistant messages', () => {
    const result = convertMessagesToOpenAI('', [
      { role: 'assistant', content: 'hello back' },
    ]);
    expect(result[0]).toEqual({ role: 'assistant', content: 'hello back' });
  });

  it('converts user messages with text blocks', () => {
    const result = convertMessagesToOpenAI('', [
      {
        role: 'user',
        content: [{ type: 'text', text: 'with blocks' }],
      },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].role).toBe('user');
    expect((result[0] as { content: unknown[] }).content).toEqual([
      { type: 'text', text: 'with blocks' },
    ]);
  });

  it('converts user messages with base64 images', () => {
    const result = convertMessagesToOpenAI('', [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: 'image/png', data: 'abc123' },
          },
        ],
      },
    ]);
    expect(result).toHaveLength(1);
    const content = (result[0] as { content: unknown[] }).content;
    expect(content).toHaveLength(1);
    expect((content[0] as { type: string; image_url: { url: string } }).image_url.url).toBe(
      'data:image/png;base64,abc123'
    );
  });

  it('converts user messages with URL images', () => {
    const result = convertMessagesToOpenAI('', [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'url', url: 'https://example.com/img.png' },
          } as Anthropic.ImageBlockParam,
        ],
      },
    ]);
    expect(result).toHaveLength(1);
    const content = (result[0] as { content: unknown[] }).content;
    expect((content[0] as { type: string; image_url: { url: string } }).image_url.url).toBe(
      'https://example.com/img.png'
    );
  });

  it('converts assistant messages with tool_use blocks', () => {
    const result = convertMessagesToOpenAI('', [
      {
        role: 'assistant',
        content: [
          { type: 'text', text: 'Let me search' },
          {
            type: 'tool_use',
            id: 'toolu_123',
            name: 'web_search',
            input: { query: 'test' },
          },
        ],
      },
    ]);
    expect(result).toHaveLength(1);
    const msg = result[0] as OpenAI.Chat.ChatCompletionAssistantMessageParam;
    expect(msg.role).toBe('assistant');
    expect(msg.content).toBe('Let me search');
    expect(msg.tool_calls).toHaveLength(1);
    expect(msg.tool_calls![0].id).toBe('toolu_123');
    const tc = msg.tool_calls![0] as { id: string; type: 'function'; function: { name: string; arguments: string } };
    expect(tc.function.name).toBe('web_search');
    expect(tc.function.arguments).toBe('{"query":"test"}');
  });

  it('converts user messages with tool_result blocks', () => {
    const result = convertMessagesToOpenAI('', [
      {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'toolu_123',
            content: 'search result here',
          },
        ],
      },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      role: 'tool',
      tool_call_id: 'toolu_123',
      content: 'search result here',
    });
  });

  // Bug 2 regression: mixed text + tool_result should preserve both
  it('preserves both text and tool_result blocks in mixed user messages', () => {
    const result = convertMessagesToOpenAI('', [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Here is context' },
          {
            type: 'tool_result',
            tool_use_id: 'toolu_456',
            content: 'tool output',
          },
        ],
      },
    ]);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      role: 'tool',
      tool_call_id: 'toolu_456',
      content: 'tool output',
    });
    expect(result[1].role).toBe('user');
    expect((result[1] as { content: unknown[] }).content).toEqual([
      { type: 'text', text: 'Here is context' },
    ]);
  });

  // tool messages must immediately follow the assistant message with tool_calls
  it('emits tool messages before user messages in mixed content', () => {
    const result = convertMessagesToOpenAI('', [
      {
        role: 'assistant',
        content: [
          { type: 'text', text: 'calling tool' },
          { type: 'tool_use', id: 'toolu_A', name: 'search', input: { q: 'x' } },
        ],
      },
      {
        role: 'user',
        content: [
          { type: 'tool_result', tool_use_id: 'toolu_A', content: 'result' },
          { type: 'text', text: 'extra context' },
        ],
      },
    ]);
    expect(result[0].role).toBe('assistant');
    expect(result[1].role).toBe('tool');
    expect(result[2].role).toBe('user');
  });

  it('joins multiple text blocks in assistant messages', () => {
    const result = convertMessagesToOpenAI('', [
      {
        role: 'assistant',
        content: [
          { type: 'text', text: 'line one' },
          { type: 'text', text: 'line two' },
        ],
      },
    ]);
    const msg = result[0] as OpenAI.Chat.ChatCompletionAssistantMessageParam;
    expect(msg.content).toBe('line one\nline two');
  });
});

describe('convertOpenAIResponseToAnthropic', () => {
  const makeCompletion = (overrides: Partial<OpenAI.Chat.ChatCompletion> = {}): OpenAI.Chat.ChatCompletion => ({
    id: 'chatcmpl-test',
    object: 'chat.completion',
    created: Date.now(),
    model: 'gpt-4o',
    choices: [
      {
        index: 0,
        message: { role: 'assistant', content: 'Hello', refusal: null },
        finish_reason: 'stop',
        logprobs: null,
      },
    ],
    usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
    ...overrides,
  });

  it('converts text response with end_turn stop_reason', () => {
    const result = convertOpenAIResponseToAnthropic(makeCompletion());
    expect(result.id).toBe('chatcmpl-test');
    expect(result.type).toBe('message');
    expect(result.role).toBe('assistant');
    expect(result.stop_reason).toBe('end_turn');
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('text');
    expect((result.content[0] as Anthropic.TextBlock).text).toBe('Hello');
  });

  it('converts tool_calls response with tool_use stop_reason', () => {
    const result = convertOpenAIResponseToAnthropic(
      makeCompletion({
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: null,
              refusal: null,
              tool_calls: [
                {
                  id: 'call_abc',
                  type: 'function',
                  function: { name: 'web_search', arguments: '{"query":"test"}' },
                },
              ],
            },
            finish_reason: 'tool_calls',
            logprobs: null,
          },
        ],
      })
    );
    expect(result.stop_reason).toBe('tool_use');
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('tool_use');
    const block = result.content[0] as Anthropic.ToolUseBlock;
    expect(block.id).toBe('call_abc');
    expect(block.name).toBe('web_search');
    expect(block.input).toEqual({ query: 'test' });
  });

  it('maps usage tokens correctly', () => {
    const result = convertOpenAIResponseToAnthropic(makeCompletion());
    expect(result.usage.input_tokens).toBe(10);
    expect(result.usage.output_tokens).toBe(5);
  });

  // Bug 3 regression: malformed function arguments should not throw
  it('handles malformed function arguments gracefully', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = convertOpenAIResponseToAnthropic(
      makeCompletion({
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: null,
              refusal: null,
              tool_calls: [
                {
                  id: 'call_bad',
                  type: 'function',
                  function: { name: 'some_tool', arguments: '{{invalid json' },
                },
              ],
            },
            finish_reason: 'tool_calls',
            logprobs: null,
          },
        ],
      })
    );
    expect(result.content).toHaveLength(1);
    const block = result.content[0] as Anthropic.ToolUseBlock;
    expect(block.input).toEqual({ _raw: '{{invalid json' });
    spy.mockRestore();
  });

  it('handles response with both text and tool_calls', () => {
    const result = convertOpenAIResponseToAnthropic(
      makeCompletion({
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'Let me search for that',
              refusal: null,
              tool_calls: [
                {
                  id: 'call_xyz',
                  type: 'function',
                  function: { name: 'web_search', arguments: '{"q":"test"}' },
                },
              ],
            },
            finish_reason: 'tool_calls',
            logprobs: null,
          },
        ],
      })
    );
    expect(result.stop_reason).toBe('tool_use');
    expect(result.content).toHaveLength(2);
    expect(result.content[0].type).toBe('text');
    expect(result.content[1].type).toBe('tool_use');
  });

  it('returns fallback empty text block when content and tool_calls are both absent', () => {
    const result = convertOpenAIResponseToAnthropic(
      makeCompletion({
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: null, refusal: null },
            finish_reason: 'stop',
            logprobs: null,
          },
        ],
      })
    );
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('text');
    expect((result.content[0] as Anthropic.TextBlock).text).toBe('');
  });
});
