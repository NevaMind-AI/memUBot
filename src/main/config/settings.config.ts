import * as fs from 'fs/promises'
import * as path from 'path'
import { app } from 'electron'

const CONFIG_DIR = 'config'
const SETTINGS_FILE = 'settings.json'

/**
 * LLM Provider type
 */
export type LLMProvider = 'claude' | 'minimax' | 'zenmux' | 'custom'

/**
 * Provider configurations
 */
export const PROVIDER_CONFIGS: Record<LLMProvider, { name: string; baseUrl: string; defaultModel: string }> = {
  claude: {
    name: 'Claude (Anthropic)',
    baseUrl: '',  // Empty = use Anthropic default
    defaultModel: 'claude-opus-4-5'
  },
  minimax: {
    name: 'MiniMax',
    baseUrl: 'https://api.minimaxi.com/anthropic',
    defaultModel: 'MiniMax-M2.1'
  },
  zenmux: {
    name: 'Zenmux',
    baseUrl: 'https://zenmux.ai/api/anthropic',
    defaultModel: ''
  },
  custom: {
    name: 'Custom Provider',
    baseUrl: '',
    defaultModel: ''
  }
}

/**
 * Application settings
 */
export interface AppSettings {
  // LLM Provider selection
  llmProvider: LLMProvider
  
  // Claude (Anthropic) settings
  claudeApiKey: string
  claudeModel: string
  
  // MiniMax settings
  minimaxApiKey: string
  minimaxModel: string
  
  // Zenmux settings
  zenmuxApiKey: string
  zenmuxModel: string
  
  // Custom provider settings
  customApiKey: string
  customBaseUrl: string
  customModel: string
  
  // Shared LLM settings
  maxTokens: number
  temperature: number
  systemPrompt: string
  modelTier: 'agile' | 'smart' | 'deep'

  memuBaseUrl: string
  memuApiKey: string
  memuUserId: string
  memuAgentId: string
  memuProactiveUserId: string
  memuProactiveAgentId: string

  memuYumiUserId: string
  memuYumiAgentId: string

  // Telegram settings
  telegramBotToken: string
  telegramAutoConnect: boolean

  // Discord settings
  discordBotToken: string
  discordAutoConnect: boolean

  // WhatsApp settings (placeholder for future implementation)
  whatsappEnabled: boolean

  // Slack settings
  slackBotToken: string
  slackAppToken: string
  slackAutoConnect: boolean

  // Line settings
  lineChannelAccessToken: string
  lineChannelSecret: string

  // Feishu settings
  feishuAppId: string
  feishuAppSecret: string
  feishuAutoConnect: boolean

  // General settings
  language: string

  // Experimental features
  experimentalVisualMode: boolean
  experimentalComputerUse: boolean

  // Debug/Dev features
  showAgentActivity: boolean

  // Search settings
  tavilyApiKey: string

  // Power settings
  preventSleep: boolean
}

const DEFAULT_SETTINGS: AppSettings = {
  // LLM Provider selection
  llmProvider: 'claude',
  
  // Claude settings
  claudeApiKey: '',
  claudeModel: 'claude-opus-4-5',
  
  // MiniMax settings
  minimaxApiKey: '',
  minimaxModel: 'MiniMax-M2.1',
  
  // Zenmux settings
  zenmuxApiKey: '',
  zenmuxModel: '',
  
  // Custom provider settings
  customApiKey: '',
  customBaseUrl: '',
  customModel: '',
  
  // Shared LLM settings
  maxTokens: 8192,
  temperature: 0.7,
  systemPrompt: '',
  modelTier: 'smart',

  memuBaseUrl: 'https://api.memu.so',
  memuApiKey: '',
  memuUserId: 'bot_main_user',
  memuAgentId: 'bot_main_agent',
  memuProactiveUserId: 'bot_proactive_user',
  memuProactiveAgentId: 'bot_proactive_agent',

  memuYumiUserId: 'yumi_user',
  memuYumiAgentId: 'yumi_agent',

  telegramBotToken: '',
  telegramAutoConnect: true,
  discordBotToken: '',
  discordAutoConnect: true,

  whatsappEnabled: false,

  slackBotToken: '',
  slackAppToken: '',
  slackAutoConnect: true,

  lineChannelAccessToken: '',
  lineChannelSecret: '',

  feishuAppId: '',
  feishuAppSecret: '',
  feishuAutoConnect: true,

  language: 'en',

  // Experimental features
  experimentalVisualMode: false,
  experimentalComputerUse: false,

  // Debug/Dev features
  showAgentActivity: false,

  // Search settings
  tavilyApiKey: '',

  // Power settings
  preventSleep: true
}

/**
 * Settings manager
 */
class SettingsManager {
  private configPath: string
  private settings: AppSettings = { ...DEFAULT_SETTINGS }
  private initialized = false

  constructor() {
    this.configPath = path.join(app.getPath('userData'), CONFIG_DIR)
  }

  /**
   * Initialize and load settings
   */
  async initialize(): Promise<void> {
    if (this.initialized) return

    try {
      await fs.mkdir(this.configPath, { recursive: true })
      const filePath = path.join(this.configPath, SETTINGS_FILE)
      const content = await fs.readFile(filePath, 'utf-8')
      const saved = JSON.parse(content) as Partial<AppSettings>

      // Merge with defaults to ensure all fields exist
      this.settings = { ...DEFAULT_SETTINGS, ...saved }
      
      // Migration: ensure provider is set (for existing users)
      if (!saved.llmProvider && saved.claudeApiKey) {
        console.log('[Settings] Setting default LLM provider to Claude (existing user)')
        this.settings.llmProvider = 'claude'
        await this.saveToFile()
      }
      
      console.log('[Settings] Loaded settings')
    } catch {
      // File doesn't exist, use defaults
      this.settings = { ...DEFAULT_SETTINGS }
      console.log('[Settings] Using default settings')
    }

    this.initialized = true
  }

  /**
   * Ensure initialized
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize()
    }
  }

  /**
   * Get all settings
   */
  async getSettings(): Promise<AppSettings> {
    await this.ensureInitialized()
    return { ...this.settings }
  }

  /**
   * Get a specific setting
   */
  async get<K extends keyof AppSettings>(key: K): Promise<AppSettings[K]> {
    await this.ensureInitialized()
    return this.settings[key]
  }

  /**
   * Save current settings to file
   */
  private async saveToFile(): Promise<void> {
    const filePath = path.join(this.configPath, SETTINGS_FILE)
    await fs.writeFile(filePath, JSON.stringify(this.settings, null, 2), 'utf-8')
  }

  /**
   * Update settings
   */
  async updateSettings(updates: Partial<AppSettings>): Promise<void> {
    await this.ensureInitialized()
    this.settings = { ...this.settings, ...updates }
    await this.saveToFile()
    console.log('[Settings] Settings saved')
  }

  /**
   * Reset to defaults
   */
  async resetSettings(): Promise<void> {
    this.settings = { ...DEFAULT_SETTINGS }
    await this.saveToFile()
    console.log('[Settings] Settings reset to defaults')
  }

  /**
   * Get effective LLM configuration based on current provider
   */
  getEffectiveLLMConfig(): { apiKey: string; baseUrl: string; model: string; provider: LLMProvider } {
    const provider = this.settings.llmProvider || 'claude'
    
    switch (provider) {
      case 'claude':
        return {
          apiKey: this.settings.claudeApiKey,
          baseUrl: '',  // Use Anthropic default
          model: this.settings.claudeModel || 'claude-opus-4-5',
          provider
        }
      case 'minimax':
        return {
          apiKey: this.settings.minimaxApiKey,
          baseUrl: 'https://api.minimaxi.com/anthropic',
          model: this.settings.minimaxModel || 'MiniMax-M2.1',
          provider
        }
      case 'zenmux':
        return {
          apiKey: this.settings.zenmuxApiKey,
          baseUrl: 'https://zenmux.ai/api/anthropic',
          model: this.settings.zenmuxModel,
          provider
        }
      case 'custom':
        return {
          apiKey: this.settings.customApiKey,
          baseUrl: this.settings.customBaseUrl,
          model: this.settings.customModel,
          provider
        }
      default:
        return {
          apiKey: this.settings.claudeApiKey,
          baseUrl: '',
          model: this.settings.claudeModel || 'claude-opus-4-5',
          provider: 'claude'
        }
    }
  }
}

// Export singleton instance
export const settingsManager = new SettingsManager()

// Helper functions for easy access
export async function loadSettings(): Promise<AppSettings> {
  return settingsManager.getSettings()
}

export async function saveSettings(updates: Partial<AppSettings>): Promise<void> {
  return settingsManager.updateSettings(updates)
}

export async function getSetting<K extends keyof AppSettings>(key: K): Promise<AppSettings[K]> {
  return settingsManager.get(key)
}
