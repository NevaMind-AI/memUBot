import * as fs from 'fs/promises'
import * as path from 'path'
import { app } from 'electron'
import type { StoredYumiMessage } from './types'

const STORAGE_DIR = 'yumi-data'
const MESSAGES_FILE = 'messages.json'

/**
 * YumiStorage handles local persistence of Easemob messages.
 * Follows the same pattern as TelegramStorage / DiscordStorage etc.
 */
export class YumiStorage {
  private storagePath: string
  private messages: StoredYumiMessage[] = []
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

      if (Array.isArray(data)) {
        this.messages = data as StoredYumiMessage[]
        console.log(`[YumiStorage] Loaded ${this.messages.length} messages`)
      } else {
        console.log('[YumiStorage] Invalid format, starting fresh')
        this.messages = []
        await this.saveData()
      }
    } catch {
      this.messages = []
      console.log('[YumiStorage] No existing messages found')
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
   * Store a message (deduplicates by messageId)
   */
  async storeMessage(message: StoredYumiMessage): Promise<void> {
    await this.ensureInitialized()
    const exists = this.messages.some((m) => m.messageId === message.messageId)
    if (!exists) {
      this.messages.push(message)
      await this.saveData()
    }
  }

  /**
   * Get messages sorted by timestamp ascending
   */
  async getMessages(limit?: number): Promise<StoredYumiMessage[]> {
    await this.ensureInitialized()
    const sorted = [...this.messages].sort((a, b) => a.timestamp - b.timestamp)
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
   * Delete most recent N messages
   */
  async deleteRecentMessages(count: number): Promise<number> {
    await this.ensureInitialized()
    const sorted = [...this.messages].sort((a, b) => a.timestamp - b.timestamp)
    const toDelete = Math.min(count, sorted.length)

    if (toDelete <= 0) return 0

    const idsToDelete = new Set(sorted.slice(-toDelete).map((m) => m.messageId))
    this.messages = this.messages.filter((m) => !idsToDelete.has(m.messageId))
    await this.saveData()

    return toDelete
  }

  /**
   * Delete messages within a time range
   */
  async deleteMessagesByTimeRange(startDate: Date, endDate: Date): Promise<number> {
    await this.ensureInitialized()
    const startTs = startDate.getTime()
    const endTs = endDate.getTime()

    const originalCount = this.messages.length
    this.messages = this.messages.filter((m) => m.timestamp < startTs || m.timestamp > endTs)
    await this.saveData()

    return originalCount - this.messages.length
  }
}

// Export singleton instance
export const yumiStorage = new YumiStorage()
