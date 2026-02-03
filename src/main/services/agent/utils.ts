import Anthropic from '@anthropic-ai/sdk'
import path from 'path'
import { app } from 'electron'
import { loadSettings } from '../../config/settings.config'

/**
 * Maximum number of historical messages to load as context
 */
export const MAX_CONTEXT_MESSAGES = 20

/**
 * Maximum tokens for context (leave room for response, Claude limit is 200k)
 * We use 100k to leave room for system prompt (~5k), tools (~10k), and response (~20k)
 * Also accounting for token estimation inaccuracy
 */
export const MAX_CONTEXT_TOKENS = 100000

/**
 * Estimate token count for a message
 * Using conservative estimation: ~3 chars per token (instead of 4) to avoid underestimation
 * Real tokenizers vary but being conservative prevents "prompt too long" errors
 */
export function estimateTokens(message: Anthropic.MessageParam): number {
  if (typeof message.content === 'string') {
    // Conservative: 3 chars per token instead of 4
    return Math.ceil(message.content.length / 3)
  }
  
  let tokens = 0
  for (const block of message.content) {
    if (block.type === 'text') {
      tokens += Math.ceil(block.text.length / 3)
    } else if (block.type === 'image') {
      // Base64 images are expensive - estimate based on data size
      if (block.source.type === 'base64') {
        // Base64 images: more conservative estimation
        tokens += Math.ceil(block.source.data.length / 3 * 1.5)
      } else {
        // URL-based images - estimate ~1500 tokens per image
        tokens += 1500
      }
    } else if (block.type === 'tool_use') {
      tokens += Math.ceil(JSON.stringify(block).length / 3)
    } else if (block.type === 'tool_result') {
      const content = typeof block.content === 'string' ? block.content : JSON.stringify(block.content)
      tokens += Math.ceil(content.length / 3)
    }
  }
  return tokens
}

/**
 * Get the default output directory for agent-generated files
 */
export function getDefaultOutputDir(): string {
  return path.join(app.getPath('userData'), 'agent-output')
}

/**
 * Create Anthropic client with current settings
 * Supports multiple providers: Claude, MiniMax, or custom Anthropic-compatible API
 */
export async function createClient(): Promise<{ client: Anthropic; model: string; maxTokens: number; provider: string }> {
  const settings = await loadSettings()
  const provider = settings.llmProvider || 'claude'

  // Get API key and base URL based on provider
  let apiKey: string
  let baseURL: string | undefined
  let model: string

  switch (provider) {
    case 'claude':
      apiKey = settings.claudeApiKey
      baseURL = undefined  // Use Anthropic default
      model = settings.claudeModel || 'claude-opus-4-5'
      break
    case 'minimax':
      apiKey = settings.minimaxApiKey
      baseURL = 'https://api.minimaxi.com/anthropic'
      model = settings.minimaxModel || 'MiniMax-M2.1'
      break
    case 'custom':
      apiKey = settings.customApiKey
      baseURL = settings.customBaseUrl || undefined
      model = settings.customModel
      break
    default:
      apiKey = settings.claudeApiKey
      model = settings.claudeModel || 'claude-opus-4-5'
  }

  if (!apiKey) {
    throw new Error(`API key not configured for ${provider}. Please set it in Settings.`)
  }

  const client = new Anthropic({
    apiKey,
    ...(baseURL && { baseURL })
  })

  console.log(`[Agent] Using LLM provider: ${provider}, model: ${model}${baseURL ? `, baseURL: ${baseURL}` : ''}`)

  return {
    client,
    model,
    maxTokens: settings.maxTokens,
    provider
  }
}
