import * as fs from 'fs/promises'
import * as path from 'path'
import { app } from 'electron'
import type { MessagePlatform } from './infra.service'

// ==================== Types ====================

export interface QmemoryMessage {
  id: string
  platform: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  
  // Qmemory Lite enhancements
  importance: number        // 0.0 - 1.0
  category: MessageCategory
  keywords: string[]
  sentiment: MessageSentiment
  accessCount: number
  lastAccessed: number | null
  createdAt: number
  updatedAt: number
}

export type MessageCategory = 'identity' | 'moment' | 'chatter' | 'technical' | 'task' | 'unknown'
export type MessageSentiment = 'positive' | 'neutral' | 'negative' | 'unknown'

export interface QmemoryQueryOptions {
  platform?: string
  startTime?: number
  endTime?: number
  minImportance?: number
  maxImportance?: number
  category?: MessageCategory
  sentiment?: MessageSentiment
  limit?: number
  offset?: number
  orderBy?: 'timestamp' | 'importance' | 'accessCount'
  orderDirection?: 'asc' | 'desc'
}

export interface QmemoryStats {
  totalMessages: number
  byPlatform: Record<string, number>
  byCategory: Record<string, number>
  byImportance: { high: number; medium: number; low: number }
  averageImportance: number
  oldestMessage: number | null
  newestMessage: number | null
}

// ==================== Storage ====================

const STORAGE_DIR = 'qmemory-lite'
const MESSAGES_FILE = 'messages.json'
const INDEX_FILE = 'index.json'
const STATS_FILE = 'stats.json'

interface QmemoryIndex {
  byTime: Array<{ timestamp: number; id: string }>  // Sorted by timestamp
  byPlatform: Record<string, string[]>  // platform -> message ids
  byImportance: Record<string, string[]>  // importance_tier -> message ids
  byCategory: Record<string, string[]>  // category -> message ids
}

class QmemoryLiteStorage {
  private storagePath: string
  private messages: Map<string, QmemoryMessage> = new Map()
  private index: QmemoryIndex
  private initialized = false

  constructor() {
    this.storagePath = path.join(app.getPath('userData'), STORAGE_DIR)
    this.index = {
      byTime: [],
      byPlatform: {},
      byImportance: { high: [], medium: [], low: [] },
      byCategory: {},
    }
  }

  async initialize(): Promise<void> {
    if (this.initialized) return
    await fs.mkdir(this.storagePath, { recursive: true })
    await this.loadMessages()
    await this.loadIndex()
    this.initialized = true
    console.log('[QmemoryLite] Initialized with', this.messages.size, 'messages')
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize()
    }
  }

  // ==================== Message Operations ====================

  private async loadMessages(): Promise<void> {
    try {
      const filePath = path.join(this.storagePath, MESSAGES_FILE)
      const content = await fs.readFile(filePath, 'utf-8')
      const data = JSON.parse(content)
      if (Array.isArray(data)) {
        this.messages = new Map(data.map((m: QmemoryMessage) => [m.id, m]))
        console.log(`[QmemoryLite] Loaded ${this.messages.size} messages`)
      }
    } catch {
      this.messages = new Map()
      console.log('[QmemoryLite] No existing messages found')
    }
  }

  private async saveMessages(): Promise<void> {
    const filePath = path.join(this.storagePath, MESSAGES_FILE)
    const data = Array.from(this.messages.values())
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8')
  }

  private async loadIndex(): Promise<void> {
    try {
      const filePath = path.join(this.storagePath, INDEX_FILE)
      const content = await fs.readFile(filePath, 'utf-8')
      this.index = JSON.parse(content)
    } catch {
      await this.rebuildIndex()
    }
  }

  private async saveIndex(): Promise<void> {
    const filePath = path.join(this.storagePath, INDEX_FILE)
    await fs.writeFile(filePath, JSON.stringify(this.index, null, 2), 'utf-8')
  }

  private async rebuildIndex(): Promise<void> {
    this.index = {
      byTime: [],
      byPlatform: {},
      byImportance: { high: [], medium: [], low: [] },
      byCategory: {},
    }

    const messages = Array.from(this.messages.values())
    
    // Build time index (sorted)
    this.index.byTime = messages
      .map(m => ({ timestamp: m.timestamp, id: m.id }))
      .sort((a, b) => a.timestamp - b.timestamp)

    // Build platform index
    for (const msg of messages) {
      if (!this.index.byPlatform[msg.platform]) {
        this.index.byPlatform[msg.platform] = []
      }
      this.index.byPlatform[msg.platform].push(msg.id)
    }

    // Build importance index
    for (const msg of messages) {
      const tier = this.getImportanceTier(msg.importance)
      this.index.byImportance[tier].push(msg.id)
    }

    // Build category index
    for (const msg of messages) {
      if (!this.index.byCategory[msg.category]) {
        this.index.byCategory[msg.category] = []
      }
      this.index.byCategory[msg.category].push(msg.id)
    }

    await this.saveIndex()
  }

  private getImportanceTier(importance: number): 'high' | 'medium' | 'low' {
    if (importance >= 0.7) return 'high'
    if (importance >= 0.4) return 'medium'
    return 'low'
  }

  // ==================== Public API ====================

  async addMessage(message: Omit<QmemoryMessage, 'id' | 'accessCount' | 'lastAccessed' | 'createdAt' | 'updatedAt'>): Promise<QmemoryMessage> {
    await this.ensureInitialized()
    
    const id = this.generateId()
    const now = Date.now()
    
    const fullMessage: QmemoryMessage = {
      ...message,
      id,
      accessCount: 0,
      lastAccessed: null,
      createdAt: now,
      updatedAt: now,
    }

    this.messages.set(id, fullMessage)
    await this.updateIndexesForMessage(fullMessage)
    await this.saveMessages()
    
    console.log(`[QmemoryLite] Added message ${id} (importance: ${message.importance.toFixed(2)}, category: ${message.category})`)
    return fullMessage
  }

  async getMessage(id: string): Promise<QmemoryMessage | null> {
    await this.ensureInitialized()
    const message = this.messages.get(id)
    if (message) {
      // Update access tracking
      message.accessCount++
      message.lastAccessed = Date.now()
      message.updatedAt = Date.now()
      await this.saveMessages()
    }
    return message || null
  }

  async query(options: QmemoryQueryOptions): Promise<QmemoryMessage[]> {
    await this.ensureInitialized()
    
    let candidateIds: Set<string> | null = null

    // Filter by platform (use index)
    if (options.platform) {
      const platformIds = this.index.byPlatform[options.platform] || []
      candidateIds = new Set(platformIds)
    }

    // Filter by importance (use index)
    if (options.minImportance !== undefined || options.maxImportance !== undefined) {
      const importanceIds = new Set<string>()
      const minTier = options.minImportance !== undefined ? this.getImportanceTier(options.minImportance) : 'low'
      const maxTier = options.maxImportance !== undefined ? this.getImportanceTier(options.maxImportance) : 'high'
      
      const tiers: Array<'high' | 'medium' | 'low'> = ['high', 'medium', 'low']
      const minIdx = tiers.indexOf(minTier)
      const maxIdx = tiers.indexOf(maxTier)
      
      for (let i = maxIdx; i <= minIdx; i++) {
        for (const id of this.index.byImportance[tiers[i]]) {
          importanceIds.add(id)
        }
      }
      
      if (candidateIds) {
        candidateIds = new Set([...candidateIds].filter(id => importanceIds.has(id)))
      } else {
        candidateIds = importanceIds
      }
    }

    // Filter by category (use index)
    if (options.category) {
      const categoryIds = new Set(this.index.byCategory[options.category] || [])
      if (candidateIds) {
        candidateIds = new Set([...candidateIds].filter(id => categoryIds.has(id)))
      } else {
        candidateIds = categoryIds
      }
    }

    // Get messages to filter
    let messages = candidateIds
      ? Array.from(candidateIds).map(id => this.messages.get(id)!).filter(Boolean)
      : Array.from(this.messages.values())

    // Apply time filters
    if (options.startTime !== undefined) {
      messages = messages.filter(m => m.timestamp >= options.startTime!)
    }
    if (options.endTime !== undefined) {
      messages = messages.filter(m => m.timestamp <= options.endTime!)
    }

    // Apply sentiment filter
    if (options.sentiment) {
      messages = messages.filter(m => m.sentiment === options.sentiment)
    }

    // Apply precise importance filter
    if (options.minImportance !== undefined) {
      messages = messages.filter(m => m.importance >= options.minImportance!)
    }
    if (options.maxImportance !== undefined) {
      messages = messages.filter(m => m.importance <= options.maxImportance!)
    }

    // Sort
    const orderBy = options.orderBy || 'timestamp'
    const orderDirection = options.orderDirection || 'desc'
    
    messages.sort((a, b) => {
      let cmp = 0
      if (orderBy === 'timestamp') cmp = a.timestamp - b.timestamp
      else if (orderBy === 'importance') cmp = a.importance - b.importance
      else if (orderBy === 'accessCount') cmp = a.accessCount - b.accessCount
      return orderDirection === 'desc' ? -cmp : cmp
    })

    // Apply pagination
    const offset = options.offset || 0
    const limit = options.limit || 100
    
    return messages.slice(offset, offset + limit)
  }

  async getRecentMessages(days: number = 7, limit: number = 100): Promise<QmemoryMessage[]> {
    const startTime = Date.now() - (days * 24 * 60 * 60 * 1000)
    return this.query({ startTime, orderBy: 'timestamp', orderDirection: 'desc', limit })
  }

  async getMessagesByPlatform(platform: string, limit: number = 100): Promise<QmemoryMessage[]> {
    return this.query({ platform, orderBy: 'timestamp', orderDirection: 'desc', limit })
  }

  async getHighImportanceMessages(limit: number = 50): Promise<QmemoryMessage[]> {
    return this.query({ minImportance: 0.7, orderBy: 'importance', orderDirection: 'desc', limit })
  }

  async searchMessages(query: string, limit: number = 50): Promise<QmemoryMessage[]> {
    await this.ensureInitialized()
    const lowerQuery = query.toLowerCase()
    
    const messages = Array.from(this.messages.values())
      .filter(m => 
        m.content.toLowerCase().includes(lowerQuery) ||
        m.keywords.some(k => k.toLowerCase().includes(lowerQuery))
      )
      .sort((a, b) => b.importance - a.importance)
      .slice(0, limit)
    
    return messages
  }

  async getStats(): Promise<QmemoryStats> {
    await this.ensureInitialized()
    
    const messages = Array.from(this.messages.values())
    
    const byPlatform: Record<string, number> = {}
    const byCategory: Record<string, number> = {}
    const byImportance = { high: 0, medium: 0, low: 0 }
    
    let totalImportance = 0
    let oldestMessage: number | null = null
    let newestMessage: number | null = null
    
    for (const msg of messages) {
      // Platform stats
      byPlatform[msg.platform] = (byPlatform[msg.platform] || 0) + 1
      
      // Category stats
      byCategory[msg.category] = (byCategory[msg.category] || 0) + 1
      
      // Importance stats
      const tier = this.getImportanceTier(msg.importance)
      byImportance[tier]++
      totalImportance += msg.importance
      
      // Time stats
      if (oldestMessage === null || msg.timestamp < oldestMessage) {
        oldestMessage = msg.timestamp
      }
      if (newestMessage === null || msg.timestamp > newestMessage) {
        newestMessage = msg.timestamp
      }
    }
    
    return {
      totalMessages: messages.length,
      byPlatform,
      byCategory,
      byImportance,
      averageImportance: messages.length > 0 ? totalImportance / messages.length : 0,
      oldestMessage,
      newestMessage,
    }
  }

  async deleteMessage(id: string): Promise<boolean> {
    await this.ensureInitialized()
    
    const message = this.messages.get(id)
    if (!message) return false
    
    this.messages.delete(id)
    await this.rebuildIndex()
    await this.saveMessages()
    
    console.log(`[QmemoryLite] Deleted message ${id}`)
    return true
  }

  async clearAll(): Promise<void> {
    await this.ensureInitialized()
    this.messages.clear()
    this.index = {
      byTime: [],
      byPlatform: {},
      byImportance: { high: [], medium: [], low: [] },
      byCategory: {},
    }
    await this.saveMessages()
    await this.saveIndex()
    console.log('[QmemoryLite] Cleared all messages')
  }

  private async updateIndexesForMessage(message: QmemoryMessage): Promise<void> {
    // Update time index
    this.index.byTime.push({ timestamp: message.timestamp, id: message.id })
    this.index.byTime.sort((a, b) => a.timestamp - b.timestamp)

    // Update platform index
    if (!this.index.byPlatform[message.platform]) {
      this.index.byPlatform[message.platform] = []
    }
    this.index.byPlatform[message.platform].push(message.id)

    // Update importance index
    const tier = this.getImportanceTier(message.importance)
    this.index.byImportance[tier].push(message.id)

    // Update category index
    if (!this.index.byCategory[message.category]) {
      this.index.byCategory[message.category] = []
    }
    this.index.byCategory[message.category].push(message.id)

    await this.saveIndex()
  }

  private generateId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }
}

export const qmemoryLiteStorage = new QmemoryLiteStorage()
