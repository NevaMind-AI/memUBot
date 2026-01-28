import * as fs from 'fs/promises'
import * as path from 'path'
import { app } from 'electron'
import type { StoredDiscordMessage } from './types'

const STORAGE_DIR = 'discord-data'
const MESSAGES_FILE = 'messages.json'

/**
 * Discord message storage
 * Single-user mode: stores all messages in a flat list
 */
class DiscordStorage {
  private storagePath: string
  private messages: StoredDiscordMessage[] = []
  private initialized = false

  constructor() {
    this.storagePath = path.join(app.getPath('userData'), STORAGE_DIR)
  }

  /**
   * Initialize storage and load data
   */
  async initialize(): Promise<void> {
    if (this.initialized) return
    await fs.mkdir(this.storagePath, { recursive: true })
    await this.loadData()
    this.initialized = true
  }

  /**
   * Ensure storage is initialized before operations
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize()
    }
  }

  /**
   * Load data from disk
   */
  private async loadData(): Promise<void> {
    try {
      const messagesPath = path.join(this.storagePath, MESSAGES_FILE)
      const content = await fs.readFile(messagesPath, 'utf-8')
      const data = JSON.parse(content)

      // Check if data is an array (new format) or object (old format)
      if (Array.isArray(data)) {
        this.messages = data as StoredDiscordMessage[]
        console.log('[Discord Storage] Loaded', this.messages.length, 'messages')
      } else {
        // Old format or corrupted, start fresh
        console.log('[Discord Storage] Invalid data format, starting fresh')
        this.messages = []
      }
    } catch {
      // File doesn't exist yet
      this.messages = []
      console.log('[Discord Storage] No existing messages found')
    }
  }

  /**
   * Save data to disk
   */
  private async saveData(): Promise<void> {
    const messagesPath = path.join(this.storagePath, MESSAGES_FILE)
    await fs.writeFile(messagesPath, JSON.stringify(this.messages, null, 2), 'utf-8')
  }

  /**
   * Store a message
   */
  async storeMessage(message: StoredDiscordMessage): Promise<void> {
    await this.ensureInitialized()

    // Check if message already exists
    const exists = this.messages.some((m) => m.messageId === message.messageId)
    if (!exists) {
      this.messages.push(message)
      await this.saveData()
    }
  }

  /**
   * Get all messages (sorted by date ascending)
   */
  async getMessages(limit?: number): Promise<StoredDiscordMessage[]> {
    await this.ensureInitialized()
    const sorted = [...this.messages].sort((a, b) => a.date - b.date)
    return limit ? sorted.slice(-limit) : sorted
  }

  /**
   * Clear all messages
   */
  async clearMessages(): Promise<void> {
    await this.ensureInitialized()
    this.messages = []
    await this.saveData()
  }

  /**
   * Get message count
   */
  async getMessageCount(): Promise<number> {
    await this.ensureInitialized()
    return this.messages.length
  }
}

// Export singleton instance
export const discordStorage = new DiscordStorage()
