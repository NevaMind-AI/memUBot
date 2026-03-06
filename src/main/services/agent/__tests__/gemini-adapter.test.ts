import { describe, it, expect } from 'vitest';
import type Anthropic from '@anthropic-ai/sdk';
import type { GenerateContentResult } from '@google/generative-ai';
import {
  convertToolsToGemini,
  convertMessagesToGemini,
  convertGeminiResponseToAnthropic,
  createToolUseIdMap,
} from '../gemini-adapter';

describe('convertToolsToGemini', () => {
  it('converts Anthropic tools to Gemini function declarations', () => {
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

    const result = convertToolsToGemini(tools);
    expect(result).toHaveLength(1);
    expect(result[0].functionDeclarations).toHaveLength(1);
    expect(result[0].functionDeclarations![0].name).toBe('web_search');
    expect(result[0].functionDeclarations![0].description).toBe('Search the web');
    // The `type: 'object'` is stripped from parameters (Gemini infers it)
    expect(result[0].functionDeclarations![0].parameters).toEqual({
      properties: { query: { type: 'string' } },
      required: ['query'],
    });
  });

  it('returns empty array for no tools', () => {
    expect(convertToolsToGemini([])).toEqual([]);
  });

  it('strips $schema and additionalProperties from tool parameters', () => {
    const tools: Anthropic.Tool[] = [
      {
        name: 'test_tool',
        description: 'A test',
        input_schema: {
          type: 'object' as const,
          $schema: 'http://json-schema.org/draft-07/schema#',
          additionalProperties: false,
          properties: {
            query: { type: 'string', $schema: 'nested' },
          },
          required: ['query'],
        },
      },
    ];

    const result = convertToolsToGemini(tools);
    const params = result[0].functionDeclarations![0].parameters as Record<string, unknown>;
    expect(params).not.toHaveProperty('$schema');
    expect(params).not.toHaveProperty('additionalProperties');
    expect(params).not.toHaveProperty('type');
    expect(params).toHaveProperty('properties');
    const props = params.properties as Record<string, Record<string, unknown>>;
    expect(props.query).not.toHaveProperty('$schema');
    expect(props.query).toHaveProperty('type');
  });
});

describe('convertMessagesToGemini', () => {
  it('converts string user messages to user/parts', () => {
    const idMap = createToolUseIdMap();
    const result = convertMessagesToGemini(
      [{ role: 'user', content: 'hello' }],
      idMap
    );
    expect(result).toHaveLength(1);
    expect(result[0].role).toBe('user');
    expect(result[0].parts).toEqual([{ text: 'hello' }]);
  });

  it('maps assistant role to model role', () => {
    const idMap = createToolUseIdMap();
    const result = convertMessagesToGemini(
      [{ role: 'assistant', content: 'hi there' }],
      idMap
    );
    expect(result).toHaveLength(1);
    expect(result[0].role).toBe('model');
    expect(result[0].parts).toEqual([{ text: 'hi there' }]);
  });

  it('converts user text blocks', () => {
    const idMap = createToolUseIdMap();
    const result = convertMessagesToGemini(
      [{ role: 'user', content: [{ type: 'text', text: 'block text' }] }],
      idMap
    );
    expect(result[0].parts).toEqual([{ text: 'block text' }]);
  });

  it('converts base64 images to inlineData', () => {
    const idMap = createToolUseIdMap();
    const result = convertMessagesToGemini(
      [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: 'image/png', data: 'abc123' },
            },
          ],
        },
      ],
      idMap
    );
    expect(result[0].parts[0]).toEqual({
      inlineData: { mimeType: 'image/png', data: 'abc123' },
    });
  });

  it('converts URL images to text placeholder', () => {
    const idMap = createToolUseIdMap();
    const result = convertMessagesToGemini(
      [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'url', url: 'https://example.com/img.png' },
            } as Anthropic.ImageBlockParam,
          ],
        },
      ],
      idMap
    );
    expect(result[0].parts[0]).toEqual({
      text: '[Image URL: https://example.com/img.png]',
    });
  });

  it('converts tool_use blocks to functionCall and registers id mapping', () => {
    const idMap = createToolUseIdMap();
    const result = convertMessagesToGemini(
      [
        {
          role: 'assistant',
          content: [
            {
              type: 'tool_use',
              id: 'toolu_abc',
              name: 'web_search',
              input: { query: 'test' },
            },
          ],
        },
      ],
      idMap
    );
    expect(result[0].role).toBe('model');
    expect(result[0].parts[0]).toEqual({
      functionCall: { name: 'web_search', args: { query: 'test' } },
    });
    expect(idMap.get('toolu_abc')).toBe('web_search');
  });

  it('converts tool_result blocks to functionResponse using id mapping', () => {
    const idMap = createToolUseIdMap();
    idMap.set('toolu_xyz', 'calculator');

    const result = convertMessagesToGemini(
      [
        {
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: 'toolu_xyz',
              content: 'result: 42',
            },
          ],
        },
      ],
      idMap
    );
    expect(result[0].parts[0]).toEqual({
      functionResponse: { name: 'calculator', response: { result: 'result: 42' } },
    });
  });

  it('handles tool_result with array content', () => {
    const idMap = createToolUseIdMap();
    idMap.set('toolu_arr', 'fetch_data');

    const result = convertMessagesToGemini(
      [
        {
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: 'toolu_arr',
              content: [
                { type: 'text', text: 'line 1' },
                { type: 'text', text: 'line 2' },
              ],
            },
          ],
        },
      ],
      idMap
    );
    expect(result[0].parts[0]).toEqual({
      functionResponse: { name: 'fetch_data', response: { result: 'line 1\nline 2' } },
    });
  });

  it('correctly maps multiple calls to the same tool by different IDs', () => {
    const idMap = createToolUseIdMap();

    convertMessagesToGemini(
      [
        {
          role: 'assistant',
          content: [
            { type: 'tool_use', id: 'toolu_1', name: 'web_search', input: { q: 'a' } },
            { type: 'tool_use', id: 'toolu_2', name: 'web_search', input: { q: 'b' } },
          ],
        },
      ],
      idMap
    );

    expect(idMap.get('toolu_1')).toBe('web_search');
    expect(idMap.get('toolu_2')).toBe('web_search');

    const resultMessages = convertMessagesToGemini(
      [
        {
          role: 'user',
          content: [
            { type: 'tool_result', tool_use_id: 'toolu_1', content: 'result A' },
            { type: 'tool_result', tool_use_id: 'toolu_2', content: 'result B' },
          ],
        },
      ],
      idMap
    );

    expect(resultMessages[0].parts).toHaveLength(2);
    expect(resultMessages[0].parts[0]).toEqual({
      functionResponse: { name: 'web_search', response: { result: 'result A' } },
    });
    expect(resultMessages[0].parts[1]).toEqual({
      functionResponse: { name: 'web_search', response: { result: 'result B' } },
    });
  });
});

describe('convertGeminiResponseToAnthropic', () => {
  const makeResult = (overrides: Record<string, unknown> = {}): GenerateContentResult => {
    const base = {
      response: {
        candidates: [
          {
            index: 0,
            content: {
              role: 'model',
              parts: [{ text: 'Hello from Gemini' }],
            },
            finishReason: 'STOP',
          },
        ],
        usageMetadata: {
          promptTokenCount: 20,
          candidatesTokenCount: 10,
          totalTokenCount: 30,
        },
        text: () => 'Hello from Gemini',
        functionCall: () => undefined,
        functionCalls: () => undefined,
      },
    };

    if (overrides.candidates) {
      base.response.candidates = overrides.candidates as typeof base.response.candidates;
    }
    if (overrides.usageMetadata) {
      base.response.usageMetadata = overrides.usageMetadata as typeof base.response.usageMetadata;
    }

    return base as unknown as GenerateContentResult;
  };

  it('converts text response with end_turn stop_reason', () => {
    const idMap = createToolUseIdMap();
    const result = convertGeminiResponseToAnthropic(makeResult(), 'gemini-2.5-pro', idMap);

    expect(result.type).toBe('message');
    expect(result.role).toBe('assistant');
    expect(result.model).toBe('gemini-2.5-pro');
    expect(result.stop_reason).toBe('end_turn');
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('text');
    expect((result.content[0] as Anthropic.TextBlock).text).toBe('Hello from Gemini');
  });

  it('converts functionCall response to tool_use with tool_use stop_reason', () => {
    const idMap = createToolUseIdMap();
    const result = convertGeminiResponseToAnthropic(
      makeResult({
        candidates: [
          {
            index: 0,
            content: {
              role: 'model',
              parts: [
                { functionCall: { name: 'web_search', args: { query: 'test' } } },
              ],
            },
            finishReason: 'STOP',
          },
        ],
      }),
      'gemini-2.5-pro',
      idMap
    );

    expect(result.stop_reason).toBe('tool_use');
    expect(result.content).toHaveLength(1);
    const block = result.content[0] as Anthropic.ToolUseBlock;
    expect(block.type).toBe('tool_use');
    expect(block.name).toBe('web_search');
    expect(block.input).toEqual({ query: 'test' });
    expect(block.id).toMatch(/^toolu_gemini_/);
    expect(idMap.get(block.id)).toBe('web_search');
  });

  it('handles response with both text and functionCall', () => {
    const idMap = createToolUseIdMap();
    const result = convertGeminiResponseToAnthropic(
      makeResult({
        candidates: [
          {
            index: 0,
            content: {
              role: 'model',
              parts: [
                { text: 'Let me search' },
                { functionCall: { name: 'web_search', args: { q: 'test' } } },
              ],
            },
            finishReason: 'STOP',
          },
        ],
      }),
      'gemini-2.5-pro',
      idMap
    );

    expect(result.stop_reason).toBe('tool_use');
    expect(result.content).toHaveLength(2);
    expect(result.content[0].type).toBe('text');
    expect(result.content[1].type).toBe('tool_use');
  });

  it('handles multiple parallel functionCall parts', () => {
    const idMap = createToolUseIdMap();
    const result = convertGeminiResponseToAnthropic(
      makeResult({
        candidates: [
          {
            index: 0,
            content: {
              role: 'model',
              parts: [
                { functionCall: { name: 'tool_a', args: { x: 1 } } },
                { functionCall: { name: 'tool_b', args: { y: 2 } } },
              ],
            },
            finishReason: 'STOP',
          },
        ],
      }),
      'gemini-2.5-pro',
      idMap
    );

    expect(result.stop_reason).toBe('tool_use');
    expect(result.content).toHaveLength(2);
    const block1 = result.content[0] as Anthropic.ToolUseBlock;
    const block2 = result.content[1] as Anthropic.ToolUseBlock;
    expect(block1.name).toBe('tool_a');
    expect(block2.name).toBe('tool_b');
    expect(block1.id).not.toBe(block2.id);
  });

  it('maps usage tokens correctly', () => {
    const idMap = createToolUseIdMap();
    const result = convertGeminiResponseToAnthropic(makeResult(), 'gemini-2.5-pro', idMap);
    expect(result.usage.input_tokens).toBe(20);
    expect(result.usage.output_tokens).toBe(10);
  });

  it('returns empty text block when response has no content', () => {
    const idMap = createToolUseIdMap();
    const result = convertGeminiResponseToAnthropic(
      makeResult({ candidates: [{ index: 0, content: { role: 'model', parts: [] } }] }),
      'gemini-2.5-pro',
      idMap
    );
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('text');
    expect((result.content[0] as Anthropic.TextBlock).text).toBe('');
  });
});
