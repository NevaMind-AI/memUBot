import { app } from 'electron'
import * as fs from 'fs/promises'
import * as path from 'path'
import type { StoredWhatsAppMessage } from './types'

/**
 * WhatsApp Storage
 * Handles persistent storage for WhatsApp messages and session data
 */
class WhatsAppStorage {
  private dataDir: string
  private sessionDir: string
  private messagesDir: string

  constructor() {
    this.dataDir = path.join(app.getPath('userData'), 'whatsapp-data')
    this.sessionDir = path.join(this.dataDir, 'session')
    this.messagesDir = path.join(this.dataDir, 'messages')
  }

  /**
   * Initialize storage directories
   */
  async initialize(): Promise<void> {
    await fs.mkdir(this.dataDir, { recursive: true })
    await fs.mkdir(this.sessionDir, { recursive: true })
    await fs.mkdir(this.messagesDir, { recursive: true })
    console.log('[WhatsAppStorage] Initialized at:', this.dataDir)
  }

  /**
   * Get session directory path
   */
  getSessionPath(): string {
    return this.sessionDir
  }

  /**
   * Store a message
   */
  async storeMessage(message: StoredWhatsAppMessage): Promise<void> {
    const chatDir = path.join(this.messagesDir, message.from)
    await fs.mkdir(chatDir, { recursive: true })
    
    const messageFile = path.join(chatDir, `${message.id}.json`)
    await fs.writeFile(messageFile, JSON.stringify(message, null, 2))
  }

  /**
   * Get messages for a chat
   */
  async getMessages(chatId: string, limit: number = 50): Promise<StoredWhatsAppMessage[]> {
    const chatDir = path.join(this.messagesDir, chatId)
    
    try {
      const files = await fs.readdir(chatDir)
      const messageFiles = files
        .filter(f => f.endsWith('.json'))
        .sort((a, b) => b.localeCompare(a)) // Sort by timestamp (newest first)
        .slice(0, limit)

      const messages: StoredWhatsAppMessage[] = []
      for (const file of messageFiles) {
        const content = await fs.readFile(path.join(chatDir, file), 'utf-8')
        messages.push(JSON.parse(content))
      }

      return messages
    } catch {
      return []
    }
  }

  /**
   * Clear messages for a chat or all messages
   */
  async clearMessages(chatId?: string): Promise<void> {
    if (chatId) {
      const chatDir = path.join(this.messagesDir, chatId)
      await fs.rm(chatDir, { recursive: true, force: true })
    } else {
      await fs.rm(this.messagesDir, { recursive: true, force: true })
      await fs.mkdir(this.messagesDir, { recursive: true })
    }
  }

  /**
   * Save session data
   */
  async saveSession(data: Record<string, unknown>): Promise<void> {
    const sessionFile = path.join(this.sessionDir, 'session.json')
    await fs.writeFile(sessionFile, JSON.stringify(data, null, 2))
  }

  /**
   * Load session data
   */
  async loadSession(): Promise<Record<string, unknown> | null> {
    const sessionFile = path.join(this.sessionDir, 'session.json')
    try {
      const content = await fs.readFile(sessionFile, 'utf-8')
      return JSON.parse(content)
    } catch {
      return null
    }
  }

  /**
   * Clear session data
   */
  async clearSession(): Promise<void> {
    await fs.rm(this.sessionDir, { recursive: true, force: true })
    await fs.mkdir(this.sessionDir, { recursive: true })
  }
}

export const whatsappStorage = new WhatsAppStorage()
