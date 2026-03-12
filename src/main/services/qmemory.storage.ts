import * as fs from 'fs/promises'
import * as path from 'path'
import { app } from 'electron'
import type { MessagePlatform } from './infra.service'

const STORAGE_DIR = 'qmemory-data'
const MESSAGES_FILE = 'unmemorized-messages.json'
const STATE_FILE = 'qmemory-state.json'

export interface StoredUnmemorizedMessage {
  platform: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number // Unix timestamp in seconds
}

export interface MemorizationState {
  lastTaskId: string | null
  messagesToRemoveOnSuccess: number
  firstMessageTimestamp: number | null // Timestamp of the earliest unmemorized message
}

const DEFAULT_STATE: MemorizationState = {
  lastTaskId: null,
  messagesToRemoveOnSuccess: 0,
  firstMessageTimestamp: null,
}

class QMemoryStorage {
  private storagePath: string
  private messages: StoredUnmemorizedMessage[] = []
  private state: MemorizationState = { ...DEFAULT_STATE }
  private initialized = false

  constructor() {
    this.storagePath = path.join(app.getPath('userData'), STORAGE_DIR)
  }

  async initialize(): Promise<void> {
    if (this.initialized) return
    await fs.mkdir(this.storagePath, { recursive: true })
    await this.loadMessages()
    await this.loadState()
    this.initialized = true
    console.log('[QMemoryStorage] Initialized')
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize()
    }
  }

  // ==================== Messages ====================

  private async loadMessages(): Promise<void> {
    try {
      const filePath = path.join(this.storagePath, MESSAGES_FILE)
      const content = await fs.readFile(filePath, 'utf-8')
      const data = JSON.parse(content)
      if (Array.isArray(data)) {
        this.messages = data as StoredUnmemorizedMessage[]
        console.log(`[QMemoryStorage] Loaded ${this.messages.length} unmemorized messages`)
      } else {
        this.messages = []
      }
    } catch {
      this.messages = []
      console.log('[QMemoryStorage] No existing unmemorized messages found')
    }
  }

  private async saveMessages(): Promise<void> {
    const filePath = path.join(this.storagePath, MESSAGES_FILE)
    await fs.writeFile(filePath, JSON.stringify(this.messages, null, 2), 'utf-8')
  }

  async getMessages(): Promise<StoredUnmemorizedMessage[]> {
    await this.ensureInitialized()
    return [...this.messages]
  }

  async getMessageCount(): Promise<number> {
    await this.ensureInitialized()
    return this.messages.length
  }

  async appendMessage(message: StoredUnmemorizedMessage): Promise<void> {
    await this.ensureInitialized()
    this.messages.push(message)
    await this.saveMessages()
  }

  async removeFirstN(count: number): Promise<void> {
    await this.ensureInitialized()
    this.messages.splice(0, count)
    await this.saveMessages()
    console.log(`[QMemoryStorage] Removed first ${count} messages, ${this.messages.length} remaining`)
  }

  // ==================== State ====================

  private async loadState(): Promise<void> {
    try {
      const filePath = path.join(this.storagePath, STATE_FILE)
      const content = await fs.readFile(filePath, 'utf-8')
      const data = JSON.parse(content)
      if (data && typeof data === 'object') {
        this.state = { ...DEFAULT_STATE, ...data }
        console.log('[QMemoryStorage] Loaded state:', this.state)
      }
    } catch {
      this.state = { ...DEFAULT_STATE }
      console.log('[QMemoryStorage] No existing state found')
    }
  }

  private async saveState(): Promise<void> {
    const filePath = path.join(this.storagePath, STATE_FILE)
    await fs.writeFile(filePath, JSON.stringify(this.state, null, 2), 'utf-8')
  }

  async getState(): Promise<MemorizationState> {
    await this.ensureInitialized()
    return { ...this.state }
  }

  async setState(partial: Partial<MemorizationState>): Promise<void> {
    await this.ensureInitialized()
    this.state = { ...this.state, ...partial }
    await this.saveState()
  }

  async clearTaskState(): Promise<void> {
    await this.ensureInitialized()
    this.state.lastTaskId = null
    this.state.messagesToRemoveOnSuccess = 0
    await this.saveState()
  }

  async updateFirstMessageTimestamp(): Promise<void> {
    await this.ensureInitialized()
    this.state.firstMessageTimestamp =
      this.messages.length > 0 ? this.messages[0].timestamp : null
    await this.saveState()
  }
}

export const qmemoryStorage = new QMemoryStorage()
