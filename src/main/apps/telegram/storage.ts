import * as fs from 'fs/promises'
import * as path from 'path'
import { app } from 'electron'
import type { StoredTelegramMessage } from './types'

const STORAGE_DIR = 'telegram-data'
const MESSAGES_FILE = 'messages.json'

/**
 * TelegramStorage handles local backup of Telegram messages
 * Single-user mode: all messages stored in one flat list
 */
export class TelegramStorage {
  private storagePath: string
  private messages: StoredTelegramMessage[] = []
  private initialized = false

  constructor() {
    this.storagePath = path.join(app.getPath('userData'), STORAGE_DIR)
  }

  /**
   * Initialize storage and load existing data
   */
  async initialize(): Promise<void> {
    if (this.initialized) return
    await fs.mkdir(this.storagePath, { recursive: true })
    await this.loadData()
    this.initialized = true
  }

  /**
   * Ensure storage is initialized before any operation
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
      const messagesContent = await fs.readFile(messagesPath, 'utf-8')
      const data = JSON.parse(messagesContent)

      // Check if data is an array (new format) or object (old format)
      if (Array.isArray(data)) {
        this.messages = data as StoredTelegramMessage[]
        console.log(`[Storage] Loaded ${this.messages.length} messages`)
      } else {
        // Old format detected, clear and start fresh
        console.log('[Storage] Old format detected, clearing data...')
        this.messages = []
        await this.saveData()
        console.log('[Storage] Data cleared, starting fresh')
      }
    } catch {
      // File doesn't exist yet
      this.messages = []
      console.log('[Storage] No existing messages found')
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
  async storeMessage(message: StoredTelegramMessage): Promise<void> {
    await this.ensureInitialized()
    // Check if message already exists
    const exists = this.messages.some(
      (m) => m.messageId === message.messageId && m.chatId === message.chatId
    )
    if (!exists) {
      this.messages.push(message)
      await this.saveData()
    }
  }

  /**
   * Get all messages (sorted by date ascending)
   */
  async getMessages(limit?: number): Promise<StoredTelegramMessage[]> {
    await this.ensureInitialized()
    const sorted = [...this.messages].sort((a, b) => a.date - b.date)
    return limit ? sorted.slice(-limit) : sorted
  }

  /**
   * Get total message count
   */
  async getTotalMessageCount(): Promise<number> {
    await this.ensureInitialized()
    return this.messages.length
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
   * Delete messages by count (most recent N messages)
   * @param count Number of messages to delete from the end
   * @returns Number of messages actually deleted
   */
  async deleteRecentMessages(count: number): Promise<number> {
    await this.ensureInitialized()
    const sorted = [...this.messages].sort((a, b) => a.date - b.date)
    const toDelete = count > sorted.length ? sorted.length : count
    
    if (toDelete <= 0) return 0
    
    // Get message IDs to delete (most recent ones)
    const idsToDelete = new Set(sorted.slice(-toDelete).map(m => m.messageId))
    
    this.messages = this.messages.filter(m => !idsToDelete.has(m.messageId))
    await this.saveData()
    
    return toDelete
  }

  /**
   * Delete messages within a time range
   * @param startDate Start date (inclusive)
   * @param endDate End date (inclusive)
   * @returns Number of messages deleted
   */
  async deleteMessagesByTimeRange(startDate: Date, endDate: Date): Promise<number> {
    await this.ensureInitialized()
    const startTimestamp = Math.floor(startDate.getTime() / 1000)
    const endTimestamp = Math.floor(endDate.getTime() / 1000)
    
    const originalCount = this.messages.length
    this.messages = this.messages.filter(m => m.date < startTimestamp || m.date > endTimestamp)
    await this.saveData()
    
    return originalCount - this.messages.length
  }
}

// Export singleton instance
export const telegramStorage = new TelegramStorage()
