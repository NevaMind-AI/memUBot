import Anthropic from '@anthropic-ai/sdk'
import path from 'path'
import { app } from 'electron'
import { loadSettings } from '../../config/settings.config'
import { getAuthService } from '../auth'

/**
 * Maximum number of historical messages to load as context
 */
export const MAX_CONTEXT_MESSAGES = 20

/**
 * Maximum tokens for context (client-side fallback)
 * 
 * For Claude API: Server-side context editing triggers at 100k tokens
 * This client-side limit (150k) serves as a fallback for:
 * - Non-Claude providers (MiniMax, Custom) that don't support context editing
 * - Edge cases where server-side editing doesn't trigger
 * 
 * Claude's limit is 200k, we leave room for system prompt (~5k), tools (~10k), and response (~20k)
 */
export const MAX_CONTEXT_TOKENS = 150000

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
      // Claude calculates image tokens based on pixel dimensions, NOT base64 size
      // Images are scaled to max 1568x1568, token cost = (width * height) / 750
      // Max ~3200 tokens per image, typical screenshot ~1600-2000 tokens
      // Use conservative estimate of 2000 tokens per image
      tokens += 2000
    } else if (block.type === 'tool_use') {
      tokens += Math.ceil(JSON.stringify(block).length / 3)
    } else if (block.type === 'tool_result') {
      if (typeof block.content === 'string') {
        tokens += Math.ceil(block.content.length / 3)
      } else if (Array.isArray(block.content)) {
        // tool_result content can be an array of text/image blocks
        for (const item of block.content) {
          if (item.type === 'text') {
            tokens += Math.ceil(item.text.length / 3)
          } else if (item.type === 'image') {
            // Same as regular image: ~2000 tokens per image
            tokens += 2000
          }
        }
      } else {
        // Fallback for other content types
        tokens += Math.ceil(JSON.stringify(block.content).length / 3)
      }
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
 * Get current app mode (memu or yumi)
 */
function getAppMode(): 'memu' | 'yumi' {
  return (import.meta.env.MAIN_VITE_APP_MODE as 'memu' | 'yumi') || 'memu'
}

/**
 * Yumi-specific LLM configuration (hardcoded for now)
 */
const YUMI_LLM_CONFIG = {
  apiKey: 'sk-ai-v1-0e42523cdbf0e1c4b6d65d516c3ef9c7c031697078d6a70bcca851dcd1545452',
  baseURL: 'https://zenmux.ai/api/anthropic',
  model: 'anthropic/claude-opus-4.5'
}

// const YUMI_LLM_CONFIG = {
//   baseURL: 'https://memu-dev.tail13fa45.ts.net/u/wu/be/api/v3/yumi/anthropic-complete',
//   model: ''
// }

/**
 * Create Anthropic client with current settings
 * Supports multiple providers: Claude, MiniMax, or custom Anthropic-compatible API
 * 
 * Note: Yumi mode uses a hardcoded configuration, ignoring user settings
 */
export async function createClient(): Promise<{ client: Anthropic; model: string; maxTokens: number; provider: string }> {
  const settings = await loadSettings()
  const appMode = getAppMode()
  const memuApiKey = getAuthService().getAuthState().memuApiKey
  console.log(`[Agent] Memu API key: ${memuApiKey}`)

  // Yumi mode: use hardcoded configuration
  if (appMode === 'yumi') {
    const client = new Anthropic({
      apiKey: YUMI_LLM_CONFIG.apiKey,
      baseURL: YUMI_LLM_CONFIG.baseURL
    })

    // const client = new Anthropic({
    //   apiKey: memuApiKey,
    //   baseURL: YUMI_LLM_CONFIG.baseURL,
    // })

    console.log(`[Agent] Yumi mode - using fixed LLM config: model: ${YUMI_LLM_CONFIG.model}, baseURL: ${YUMI_LLM_CONFIG.baseURL}`)

    return {
      client,
      model: YUMI_LLM_CONFIG.model,
      maxTokens: settings.maxTokens,
      provider: 'yumi'
    }
  }

  // Memu mode: use user settings
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
    case 'zenmux':
      apiKey = settings.zenmuxApiKey
      baseURL = 'https://zenmux.ai/api/anthropic'
      model = settings.zenmuxModel
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