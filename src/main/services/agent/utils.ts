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

export interface CreateClientResult {
  client: Anthropic | OpenAI | null
  model: string
  maxTokens: number
  provider: string
  geminiApiKey?: string
}

export function detectCustomProtocol(baseUrl: string | undefined, model: string): 'anthropic' | 'openai' | 'gemini' {
  if (baseUrl && /anthropic/i.test(baseUrl)) return 'anthropic'
  if (!baseUrl && /^gemini/i.test(model)) return 'gemini'
  return 'openai'
}

export async function createClient(): Promise<CreateClientResult> {
  const settings = await loadSettings()

  const provider = settings.llmProvider || 'claude'

  let apiKey: string
  let baseURL: string | undefined
  let model: string

  switch (provider) {
    case 'claude':
      apiKey = settings.claudeApiKey
      baseURL = undefined
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
      console.log(`[Agent] Using LLM provider: ${provider}, model: ${model}, baseURL: ${baseURL}`)
      return { client: new OpenAI({ apiKey, baseURL }), model, maxTokens: settings.maxTokens, provider }
    case 'openai':
      apiKey = settings.openaiApiKey
      baseURL = settings.openaiBaseUrl || 'https://api.openai.com/v1'
      model = settings.openaiModel || 'gpt-4o'
      if (!apiKey) throw new Error('API key not configured for openai. Please set it in Settings.')
      console.log(`[Agent] Using LLM provider: ${provider}, model: ${model}`)
      return { client: new OpenAI({ apiKey, baseURL }), model, maxTokens: settings.maxTokens, provider }
    case 'gemini':
      apiKey = settings.geminiApiKey
      model = settings.geminiModel || 'gemini-2.5-pro'
      if (!apiKey) throw new Error('API key not configured for gemini. Please set it in Settings.')
      console.log(`[Agent] Using LLM provider: ${provider}, model: ${model}`)
      return { client: null, model, maxTokens: settings.maxTokens, provider, geminiApiKey: apiKey }
    case 'custom': {
      apiKey = settings.customApiKey
      baseURL = settings.customBaseUrl || undefined
      model = settings.customModel
      if (!apiKey) throw new Error('API key not configured for custom provider. Please set it in Settings.')
      const protocol = detectCustomProtocol(baseURL, model)
      console.log(`[Agent] Custom provider auto-detected protocol: ${protocol}, model: ${model}, baseURL: ${baseURL}`)
      if (protocol === 'openai') {
        return { client: new OpenAI({ apiKey, baseURL }), model, maxTokens: settings.maxTokens, provider: 'openai' }
      }
      if (protocol === 'gemini') {
        return { client: null, model, maxTokens: settings.maxTokens, provider: 'gemini', geminiApiKey: apiKey }
      }
      break
    }
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

  return { client, model, maxTokens: settings.maxTokens, provider }
}
