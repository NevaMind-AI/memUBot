import * as fs from 'fs/promises'
import * as path from 'path'
import { app } from 'electron'

const CONFIG_DIR = 'config'
const SETTINGS_FILE = 'settings.json'

/**
 * Application settings
 */
export interface AppSettings {
  // Claude API settings
  claudeApiKey: string
  claudeModel: string
  maxTokens: number
  temperature: number
  systemPrompt: string

  memuBaseUrl: string
  memuApiKey: string
  memuUserId: string
  memuAgentId: string
  memuProactiveUserId: string
  memuProactiveAgentId: string

  // Telegram settings
  telegramBotToken: string

  // Discord settings
  discordBotToken: string

  // WhatsApp settings (placeholder for future implementation)
  whatsappEnabled: boolean

  // Slack settings
  slackBotToken: string
  slackAppToken: string

  // Line settings
  lineChannelAccessToken: string
  lineChannelSecret: string

  // General settings
  language: string
}

const DEFAULT_SETTINGS: AppSettings = {
  claudeApiKey: '',
  claudeModel: 'claude-opus-4-5',
  maxTokens: 8192,
  temperature: 0.7,
  systemPrompt: '',

  memuBaseUrl: 'https://api.memu.so',
  memuApiKey: '',
  memuUserId: 'bot_main_user',
  memuAgentId: 'bot_main_agent',
  memuProactiveUserId: 'bot_proactive_user',
  memuProactiveAgentId: 'bot_proactive_agent',

  telegramBotToken: '',
  discordBotToken: '',

  whatsappEnabled: false,

  slackBotToken: '',
  slackAppToken: '',

  lineChannelAccessToken: '',
  lineChannelSecret: '',

  language: 'en'
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
   * Update settings
   */
  async updateSettings(updates: Partial<AppSettings>): Promise<void> {
    await this.ensureInitialized()

    this.settings = { ...this.settings, ...updates }

    const filePath = path.join(this.configPath, SETTINGS_FILE)
    await fs.writeFile(filePath, JSON.stringify(this.settings, null, 2), 'utf-8')

    console.log('[Settings] Settings saved')
  }

  /**
   * Reset to defaults
   */
  async resetSettings(): Promise<void> {
    this.settings = { ...DEFAULT_SETTINGS }
    const filePath = path.join(this.configPath, SETTINGS_FILE)
    await fs.writeFile(filePath, JSON.stringify(this.settings, null, 2), 'utf-8')
    console.log('[Settings] Settings reset to defaults')
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
