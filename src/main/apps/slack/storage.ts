import * as fs from 'fs/promises'
import * as path from 'path'
import { app } from 'electron'
import type { StoredSlackMessage } from './types'

const STORAGE_DIR = 'slack-data'
const MESSAGES_FILE = 'messages.json'

/**
 * Slack message storage
 * Single-user mode: stores all messages in a flat list
 */
class SlackStorage {
  private storagePath: string
  private messages: StoredSlackMessage[] = []
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

      if (Array.isArray(data)) {
        this.messages = data as StoredSlackMessage[]
        console.log('[Slack Storage] Loaded', this.messages.length, 'messages')
      } else {
        console.log('[Slack Storage] Invalid data format, starting fresh')
        this.messages = []
      }
    } catch {
      this.messages = []
      console.log('[Slack Storage] No existing messages found')
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
  async storeMessage(message: StoredSlackMessage): Promise<void> {
    await this.ensureInitialized()

    const exists = this.messages.some((m) => m.messageId === message.messageId)
    if (!exists) {
      this.messages.push(message)
      await this.saveData()
    }
  }

  /**
   * Get all messages (sorted by date ascending)
   */
  async getMessages(limit?: number): Promise<StoredSlackMessage[]> {
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
export const slackStorage = new SlackStorage()
