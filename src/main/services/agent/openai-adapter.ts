import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

export function safeParseJSON(str: string): Record<string, unknown> {
  try {
    return JSON.parse(str);
  } catch {
    console.warn('[OpenAI Adapter] Failed to parse function arguments, using raw string:', str.substring(0, 200));
    return { _raw: str };
  }
}

export function convertToolsToOpenAI(tools: Anthropic.Tool[]): OpenAI.Chat.ChatCompletionTool[] {
  return tools.map((t) => ({
    type: 'function' as const,
    function: {
      name: t.name,
      description: t.description || '',
      parameters: t.input_schema as Record<string, unknown>,
    },
  }));
}

export function convertMessagesToOpenAI(
  systemPrompt: string,
  history: Anthropic.MessageParam[]
): OpenAI.Chat.ChatCompletionMessageParam[] {
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }

  for (const msg of history) {
    if (msg.role === 'user') {
      if (typeof msg.content === 'string') {
        messages.push({ role: 'user', content: msg.content });
      } else {
        const toolResults = msg.content.filter(b => b.type === 'tool_result') as Anthropic.ToolResultBlockParam[];
        const otherBlocks = msg.content.filter(b => b.type !== 'tool_result');

        for (const tr of toolResults) {
          messages.push({
            role: 'tool',
            tool_call_id: tr.tool_use_id,
            content: typeof tr.content === 'string' ? tr.content : JSON.stringify(tr.content)
          });
        }

        if (otherBlocks.length > 0) {
          const contentParts = otherBlocks.map(b => {
            if (b.type === 'text') return { type: 'text' as const, text: b.text };
            if (b.type === 'image') {
              if (b.source.type === 'base64') {
                return { type: 'image_url' as const, image_url: { url: `data:${b.source.media_type};base64,${b.source.data}` } };
              } else if (b.source.type === 'url') {
                return { type: 'image_url' as const, image_url: { url: b.source.url } };
              }
            }
            return null;
          }).filter(Boolean);
          if (contentParts.length > 0) {
            messages.push({ role: 'user', content: contentParts as OpenAI.Chat.ChatCompletionContentPart[] });
          }
        }
      }
    } else if (msg.role === 'assistant') {
      if (typeof msg.content === 'string') {
        messages.push({ role: 'assistant', content: msg.content });
      } else {
        const textBlocks = msg.content.filter(b => b.type === 'text') as Anthropic.TextBlockParam[];
        const toolUses = msg.content.filter(b => b.type === 'tool_use') as Anthropic.ToolUseBlock[];

        const openaiMsg: OpenAI.Chat.ChatCompletionAssistantMessageParam = { role: 'assistant' };
        if (textBlocks.length > 0) {
          openaiMsg.content = textBlocks.map(b => b.text).join('\n');
        }

        if (toolUses.length > 0) {
          openaiMsg.tool_calls = toolUses.map(tu => ({
            id: tu.id,
            type: 'function' as const,
            function: { name: tu.name, arguments: JSON.stringify(tu.input) }
          }));
        }
        messages.push(openaiMsg);
      }
    }
  }

  return messages;
}

export function convertOpenAIResponseToAnthropic(
  completion: OpenAI.Chat.ChatCompletion
): Anthropic.Message {
  const choice = completion.choices[0];
  const responseMsg = choice.message;

  const contentBlocks: Anthropic.ContentBlock[] = [];

  if (responseMsg.content) {
    contentBlocks.push({ type: 'text', text: responseMsg.content } as Anthropic.TextBlock);
  }

  if (responseMsg.tool_calls) {
    for (const tc of responseMsg.tool_calls) {
      if (tc.type === 'function') {
        contentBlocks.push({
          type: 'tool_use',
          id: tc.id,
          name: tc.function.name,
          input: safeParseJSON(tc.function.arguments)
        } as Anthropic.ToolUseBlock);
      }
    }
  }

  if (contentBlocks.length === 0) {
    contentBlocks.push({ type: 'text', text: '' } as Anthropic.TextBlock);
  }

  const usage = {
    input_tokens: completion.usage?.prompt_tokens || 0,
    output_tokens: completion.usage?.completion_tokens || 0
  } as Anthropic.Usage;

  return {
    id: completion.id,
    type: 'message',
    role: 'assistant',
    content: contentBlocks,
    model: completion.model,
    stop_reason: choice.finish_reason === 'tool_calls' ? 'tool_use' : 'end_turn',
    stop_sequence: null,
    usage: usage
  };
}

export async function runOpenAIAdapter(
  client: OpenAI,
  model: string,
  maxTokens: number,
  temperature: number = 0.7,
  systemPrompt: string,
  tools: Anthropic.Tool[],
  history: Anthropic.MessageParam[]
): Promise<Anthropic.Message> {
  const openaiTools = convertToolsToOpenAI(tools);
  const messages = convertMessagesToOpenAI(systemPrompt, history);

  const completion = await client.chat.completions.create({
    model,
    messages,
    tools: openaiTools.length > 0 ? openaiTools : undefined,
    max_tokens: maxTokens,
    temperature
  });

  return convertOpenAIResponseToAnthropic(completion);
}
