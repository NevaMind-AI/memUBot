import * as fs from 'fs/promises'
import * as path from 'path'
import { app } from 'electron'
import type Anthropic from '@anthropic-ai/sdk'
import type { MessagePlatform } from './agent.service'

const STORAGE_DIR = 'proactive-data'
const MESSAGES_FILE = 'messages.json'
const TIMESTAMPS_FILE = 'chat-timestamps.json'

/**
 * Chat platform (excluding 'none')
 */
export type ChatPlatform = Exclude<MessagePlatform, 'none'>

/**
 * Platform timestamps record for tracking last memorized message
 */
export type ChatPlatformTimestamps = Partial<Record<ChatPlatform, number>>

/**
 * Stored proactive message format
 */
export interface StoredProactiveMessage {
  id: string
  role: 'user' | 'assistant'
  content: string // Serialized Anthropic content
  date: number // Unix timestamp in seconds
  platform?: MessagePlatform // For assistant messages sent to a platform
}

/**
 * Proactive agent message storage
 * Stores conversation history messages for the proactive agent
 * Note: Does not auto-load on initialization (per design requirements)
 */
class ProactiveStorage {
  private storagePath: string
  private messages: StoredProactiveMessage[] = []
  private chatTimestamps: ChatPlatformTimestamps = {}
  private initialized = false
  private messageCounter = 0

  constructor() {
    this.storagePath = path.join(app.getPath('userData'), STORAGE_DIR)
  }

  /**
   * Initialize storage (creates directory but does NOT load existing messages)
   * Note: We DO load chat timestamps on initialization
   */
  async initialize(): Promise<void> {
    if (this.initialized) return
    await fs.mkdir(this.storagePath, { recursive: true })
    // Load chat timestamps (needed for filtering messages on first tick)
    await this.loadChatTimestamps()
    // Note: We intentionally do NOT load existing messages on initialization
    this.initialized = true
    console.log('[Proactive Storage] Initialized (without loading existing messages)')
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
   * Load chat timestamps from disk
   */
  private async loadChatTimestamps(): Promise<void> {
    try {
      const timestampsPath = path.join(this.storagePath, TIMESTAMPS_FILE)
      const content = await fs.readFile(timestampsPath, 'utf-8')
      const data = JSON.parse(content)

      if (data && typeof data === 'object' && !Array.isArray(data)) {
        this.chatTimestamps = data as ChatPlatformTimestamps
        console.log('[Proactive Storage] Loaded chat timestamps:', this.chatTimestamps)
      } else {
        console.log('[Proactive Storage] Invalid timestamps format, starting fresh')
        this.chatTimestamps = {}
      }
    } catch {
      this.chatTimestamps = {}
      console.log('[Proactive Storage] No existing chat timestamps found')
    }
  }

  /**
   * Save chat timestamps to disk
   */
  private async saveChatTimestamps(): Promise<void> {
    const timestampsPath = path.join(this.storagePath, TIMESTAMPS_FILE)
    await fs.writeFile(timestampsPath, JSON.stringify(this.chatTimestamps, null, 2), 'utf-8')
  }

  /**
   * Get chat timestamps for all platforms
   */
  async getChatTimestamps(): Promise<ChatPlatformTimestamps> {
    await this.ensureInitialized()
    return { ...this.chatTimestamps }
  }

  /**
   * Get last memorized timestamp for a specific platform
   */
  async getChatTimestamp(platform: ChatPlatform): Promise<number | undefined> {
    await this.ensureInitialized()
    return this.chatTimestamps[platform]
  }

  /**
   * Update chat timestamps (merge with existing)
   */
  async updateChatTimestamps(timestamps: ChatPlatformTimestamps): Promise<void> {
    await this.ensureInitialized()
    this.chatTimestamps = { ...this.chatTimestamps, ...timestamps }
    await this.saveChatTimestamps()
    console.log('[Proactive Storage] Updated chat timestamps:', this.chatTimestamps)
  }

  /**
   * Load data from disk (can be called manually if needed)
   */
  async loadData(): Promise<void> {
    await this.ensureInitialized()
    try {
      const messagesPath = path.join(this.storagePath, MESSAGES_FILE)
      const content = await fs.readFile(messagesPath, 'utf-8')
      const data = JSON.parse(content)

      if (Array.isArray(data)) {
        this.messages = data as StoredProactiveMessage[]
        // Update counter based on loaded messages
        const maxId = this.messages.reduce((max, msg) => {
          const numId = parseInt(msg.id.split('-')[1] || '0', 10)
          return Math.max(max, numId)
        }, 0)
        this.messageCounter = maxId
        console.log('[Proactive Storage] Loaded', this.messages.length, 'messages')
      } else {
        console.log('[Proactive Storage] Invalid data format, starting fresh')
        this.messages = []
      }
    } catch {
      // File doesn't exist yet
      this.messages = []
      console.log('[Proactive Storage] No existing messages found')
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
   * Generate a unique message ID
   */
  private generateId(): string {
    this.messageCounter++
    return `proactive-${this.messageCounter}-${Date.now()}`
  }

  /**
   * Serialize Anthropic message content to string
   */
  private serializeContent(content: Anthropic.MessageParam['content']): string {
    if (typeof content === 'string') {
      return content
    }
    if (Array.isArray(content)) {
      return JSON.stringify(content)
    }
    return JSON.stringify(content)
  }

  /**
   * Store a message from conversation history
   * @param message The Anthropic message param to store
   * @param platform Optional platform (for assistant messages sent to a messaging platform)
   */
  async storeMessage(
    message: Anthropic.MessageParam,
    platform?: MessagePlatform
  ): Promise<StoredProactiveMessage> {
    await this.ensureInitialized()

    const storedMessage: StoredProactiveMessage = {
      id: this.generateId(),
      role: message.role,
      content: this.serializeContent(message.content),
      date: Math.floor(Date.now() / 1000),
      platform: platform && platform !== 'none' ? platform : undefined
    }

    this.messages.push(storedMessage)
    await this.saveData()

    console.log(
      `[Proactive Storage] Message stored: ${storedMessage.id}, role: ${storedMessage.role}${storedMessage.platform ? `, platform: ${storedMessage.platform}` : ''}`
    )

    return storedMessage
  }

  /**
   * Get all messages (sorted by date ascending)
   */
  async getMessages(limit?: number): Promise<StoredProactiveMessage[]> {
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
    this.messageCounter = 0
    await this.saveData()
    console.log('[Proactive Storage] Messages cleared')
  }

  /**
   * Get message count
   */
  async getMessageCount(): Promise<number> {
    await this.ensureInitialized()
    return this.messages.length
  }

  /**
   * Get messages by platform
   */
  async getMessagesByPlatform(platform: MessagePlatform): Promise<StoredProactiveMessage[]> {
    await this.ensureInitialized()
    return this.messages.filter((m) => m.platform === platform).sort((a, b) => a.date - b.date)
  }
}

// Export singleton instance
export const proactiveStorage = new ProactiveStorage()
