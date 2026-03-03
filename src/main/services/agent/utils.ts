import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import path from 'path'
import { app } from 'electron'
import { loadSettings } from '../../config/settings.config'

// Re-export context management utilities so existing imports still work
export { MAX_CONTEXT_MESSAGES, MAX_CONTEXT_TOKENS, estimateTokens } from './context'

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
export async function createClient(): Promise<{ client: Anthropic | OpenAI; model: string; maxTokens: number; provider: string }> {
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
    case 'zenmux':
      apiKey = settings.zenmuxApiKey
      baseURL = 'https://zenmux.ai/api/anthropic'
      model = settings.zenmuxModel
      break
    case 'ollama':
      apiKey = 'ollama'
      baseURL = settings.ollamaBaseUrl || 'http://localhost:11434/v1'
      model = settings.ollamaModel || 'llama3'
      return { client: new OpenAI({ apiKey, baseURL }), model, maxTokens: settings.maxTokens, provider }
    case 'openai':
      apiKey = settings.openaiApiKey
      baseURL = settings.openaiBaseUrl || 'https://api.openai.com/v1'
      model = settings.openaiModel || 'gpt-4o'
      return { client: new OpenAI({ apiKey, baseURL }), model, maxTokens: settings.maxTokens, provider }
    case 'custom':
      apiKey = settings.customApiKey
      baseURL = settings.customBaseUrl || undefined
      model = settings.customModel
      if (settings.customFormat === 'openai') {
        return { client: new OpenAI({ apiKey, baseURL }), model, maxTokens: settings.maxTokens, provider }
      }
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
