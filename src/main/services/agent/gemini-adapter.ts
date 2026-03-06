import {
  GoogleGenerativeAI,
  type Content,
  type Part,
  type FunctionDeclarationsTool,
  type GenerateContentResult,
  type FunctionDeclaration,
} from '@google/generative-ai';
import Anthropic from '@anthropic-ai/sdk';

/**
 * Gemini does not use tool_use IDs. We generate synthetic IDs on the way out
 * (Gemini -> Anthropic) and resolve them on the way in (Anthropic -> Gemini)
 * by maintaining a mapping from tool_use_id -> tool name.
 */
let idCounter = 0;
function generateToolUseId(): string {
  return `toolu_gemini_${Date.now()}_${++idCounter}`;
}

function stripUnsupportedSchemaFields(obj: unknown): unknown {
  if (Array.isArray(obj)) return obj.map(stripUnsupportedSchemaFields);
  if (obj !== null && typeof obj === 'object') {
    const cleaned: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      if (k === '$schema' || k === 'additionalProperties') continue;
      cleaned[k] = stripUnsupportedSchemaFields(v);
    }
    return cleaned;
  }
  return obj;
}

export function convertToolsToGemini(tools: Anthropic.Tool[]): FunctionDeclarationsTool[] {
  if (tools.length === 0) return [];

  const functionDeclarations: FunctionDeclaration[] = tools.map((t) => {
    const { type: _type, ...parametersWithoutType } = t.input_schema as Record<string, unknown>;
    const cleaned = stripUnsupportedSchemaFields(parametersWithoutType) as Record<string, unknown>;
    return {
      name: t.name,
      description: t.description || '',
      parameters: cleaned as unknown as FunctionDeclaration['parameters'],
    };
  });

  return [{ functionDeclarations }];
}

export function convertMessagesToGemini(
  history: Anthropic.MessageParam[],
  toolUseIdToName: Map<string, string>
): Content[] {
  const contents: Content[] = [];

  for (const msg of history) {
    if (msg.role === 'user') {
      if (typeof msg.content === 'string') {
        contents.push({ role: 'user', parts: [{ text: msg.content }] });
      } else {
        const parts: Part[] = [];
        for (const block of msg.content) {
          if (block.type === 'text') {
            parts.push({ text: block.text });
          } else if (block.type === 'image') {
            if (block.source.type === 'base64') {
              parts.push({
                inlineData: {
                  mimeType: block.source.media_type,
                  data: block.source.data,
                },
              });
            } else if (block.source.type === 'url') {
              parts.push({ text: `[Image URL: ${block.source.url}]` });
            }
          } else if (block.type === 'tool_result') {
            const toolName = toolUseIdToName.get(block.tool_use_id) || 'unknown_tool';
            let responseData: object;
            if (typeof block.content === 'string') {
              responseData = { result: block.content };
            } else if (Array.isArray(block.content)) {
              const text = block.content
                .filter((b) => b.type === 'text')
                .map((b) => (b as { text: string }).text)
                .join('\n');
              responseData = { result: text || JSON.stringify(block.content) };
            } else {
              responseData = { result: '' };
            }
            parts.push({
              functionResponse: { name: toolName, response: responseData },
            });
          }
        }
        if (parts.length > 0) {
          contents.push({ role: 'user', parts });
        }
      }
    } else if (msg.role === 'assistant') {
      if (typeof msg.content === 'string') {
        contents.push({ role: 'model', parts: [{ text: msg.content }] });
      } else {
        const parts: Part[] = [];
        for (const block of msg.content) {
          if (block.type === 'text') {
            parts.push({ text: block.text });
          } else if (block.type === 'tool_use') {
            toolUseIdToName.set(block.id, block.name);
            parts.push({
              functionCall: {
                name: block.name,
                args: block.input as object,
              },
            });
          }
        }
        if (parts.length > 0) {
          contents.push({ role: 'model', parts });
        }
      }
    }
  }

  return contents;
}

export function convertGeminiResponseToAnthropic(
  result: GenerateContentResult,
  modelName: string,
  toolUseIdToName: Map<string, string>
): Anthropic.Message {
  const response = result.response;
  const candidate = response.candidates?.[0];

  const contentBlocks: Anthropic.ContentBlock[] = [];
  let hasToolUse = false;

  if (candidate?.content?.parts) {
    for (const part of candidate.content.parts) {
      if ('text' in part && part.text) {
        contentBlocks.push({ type: 'text', text: part.text } as Anthropic.TextBlock);
      } else if ('functionCall' in part && part.functionCall) {
        hasToolUse = true;
        const toolId = generateToolUseId();
        toolUseIdToName.set(toolId, part.functionCall.name);
        contentBlocks.push({
          type: 'tool_use',
          id: toolId,
          name: part.functionCall.name,
          input: part.functionCall.args || {},
        } as Anthropic.ToolUseBlock);
      }
    }
  }

  if (contentBlocks.length === 0) {
    contentBlocks.push({ type: 'text', text: '' } as Anthropic.TextBlock);
  }

  const usage = {
    input_tokens: response.usageMetadata?.promptTokenCount || 0,
    output_tokens: response.usageMetadata?.candidatesTokenCount || 0,
  } as Anthropic.Usage;

  const stopReason = hasToolUse ? 'tool_use' : 'end_turn';

  return {
    id: `gemini-${Date.now()}`,
    type: 'message',
    role: 'assistant',
    content: contentBlocks,
    model: modelName,
    stop_reason: stopReason,
    stop_sequence: null,
    usage,
  };
}

/**
 * Persistent mapping from tool_use_id -> tool name across a conversation.
 * The adapter caller should keep one instance per conversation/agent loop.
 */
export function createToolUseIdMap(): Map<string, string> {
  return new Map();
}

export async function runGeminiAdapter(
  apiKey: string,
  model: string,
  maxTokens: number,
  temperature: number = 0.7,
  systemPrompt: string,
  tools: Anthropic.Tool[],
  history: Anthropic.MessageParam[],
  toolUseIdToName?: Map<string, string>
): Promise<Anthropic.Message> {
  const genAI = new GoogleGenerativeAI(apiKey);

  const geminiTools = convertToolsToGemini(tools);
  const idMap = toolUseIdToName || createToolUseIdMap();
  const contents = convertMessagesToGemini(history, idMap);

  const genModel = genAI.getGenerativeModel({
    model,
    tools: geminiTools.length > 0 ? geminiTools : undefined,
    generationConfig: {
      maxOutputTokens: maxTokens,
      temperature,
    },
    systemInstruction: systemPrompt || undefined,
  });

  const result = await genModel.generateContent({ contents });
  return convertGeminiResponseToAnthropic(result, model, idMap);
}
