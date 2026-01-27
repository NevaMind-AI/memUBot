/**
 * Security Service
 * Manages security codes for user binding
 */

import * as fs from 'fs/promises'
import * as path from 'path'
import { app } from 'electron'

interface SecurityCode {
  code: string
  createdAt: number
  expiresAt: number
}

interface BoundUser {
  userId: number
  username: string
  firstName?: string
  lastName?: string
  boundAt: number
}

const STORAGE_DIR = 'security-data'
const BOUND_USERS_FILE = 'bound-users.json'

class SecurityService {
  private currentCode: SecurityCode | null = null
  private boundUsers: Map<number, BoundUser> = new Map()
  private storagePath: string
  private initialized = false
  private readonly CODE_EXPIRY_MS = 3 * 60 * 1000 // 3 minutes
  private readonly CODE_LENGTH = 6

  constructor() {
    this.storagePath = path.join(app.getPath('userData'), STORAGE_DIR)
  }

  /**
   * Initialize storage and load existing data
   */
  async initialize(): Promise<void> {
    if (this.initialized) return
    await fs.mkdir(this.storagePath, { recursive: true })
    await this.loadBoundUsersFromDisk()
    this.initialized = true
  }

  /**
   * Load bound users from disk
   */
  private async loadBoundUsersFromDisk(): Promise<void> {
    try {
      const filePath = path.join(this.storagePath, BOUND_USERS_FILE)
      const content = await fs.readFile(filePath, 'utf-8')
      const users = JSON.parse(content) as BoundUser[]
      this.boundUsers.clear()
      for (const user of users) {
        this.boundUsers.set(user.userId, user)
      }
      console.log(`[Security] Loaded ${users.length} bound users`)
    } catch {
      console.log('[Security] No existing bound users found')
    }
  }

  /**
   * Save bound users to disk
   */
  private async saveBoundUsersToDisk(): Promise<void> {
    const filePath = path.join(this.storagePath, BOUND_USERS_FILE)
    const users = Array.from(this.boundUsers.values())
    await fs.writeFile(filePath, JSON.stringify(users, null, 2), 'utf-8')
  }

  /**
   * Ensure storage is initialized
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize()
    }
  }

  /**
   * Generate a new security code
   * Returns the generated code
   */
  generateCode(): string {
    // Generate 6-digit numeric code
    const code = Math.floor(100000 + Math.random() * 900000).toString()

    const now = Date.now()
    this.currentCode = {
      code,
      createdAt: now,
      expiresAt: now + this.CODE_EXPIRY_MS
    }

    console.log(`[Security] Generated code: ${code}, expires in 3 minutes`)
    return code
  }

  /**
   * Get current security code info (without revealing the code)
   */
  getCodeInfo(): { active: boolean; expiresAt?: number; remainingSeconds?: number } {
    if (!this.currentCode) {
      return { active: false }
    }

    const now = Date.now()
    if (now >= this.currentCode.expiresAt) {
      this.currentCode = null
      return { active: false }
    }

    return {
      active: true,
      expiresAt: this.currentCode.expiresAt,
      remainingSeconds: Math.ceil((this.currentCode.expiresAt - now) / 1000)
    }
  }

  /**
   * Validate a security code and bind a user
   * Returns true if successful, false otherwise
   */
  async validateAndBind(
    code: string,
    userId: number,
    username: string,
    firstName?: string,
    lastName?: string
  ): Promise<{ success: boolean; error?: string }> {
    await this.ensureInitialized()

    // Check if there's an active code
    if (!this.currentCode) {
      return { success: false, error: 'No active security code. Please generate a new one.' }
    }

    // Check if code is expired
    const now = Date.now()
    if (now >= this.currentCode.expiresAt) {
      this.currentCode = null
      return { success: false, error: 'Security code has expired. Please generate a new one.' }
    }

    // Validate code
    if (this.currentCode.code !== code) {
      return { success: false, error: 'Invalid security code.' }
    }

    // Check if user is already bound
    if (this.boundUsers.has(userId)) {
      // Consume the code anyway
      this.currentCode = null
      return { success: false, error: 'This account is already bound to this device.' }
    }

    // Bind the user
    this.boundUsers.set(userId, {
      userId,
      username,
      firstName,
      lastName,
      boundAt: now
    })

    // Save to disk
    await this.saveBoundUsersToDisk()

    // Consume the code (one-time use)
    this.currentCode = null

    console.log(`[Security] User ${username} (${userId}) successfully bound`)
    return { success: true }
  }

  /**
   * Check if a user is authorized
   */
  async isAuthorized(userId: number): Promise<boolean> {
    await this.ensureInitialized()
    return this.boundUsers.has(userId)
  }

  /**
   * Get all bound users
   */
  async getBoundUsers(): Promise<BoundUser[]> {
    await this.ensureInitialized()
    return Array.from(this.boundUsers.values())
  }

  /**
   * Remove a bound user
   */
  async removeBoundUser(userId: number): Promise<boolean> {
    await this.ensureInitialized()
    const existed = this.boundUsers.has(userId)
    this.boundUsers.delete(userId)
    if (existed) {
      await this.saveBoundUsersToDisk()
      console.log(`[Security] User ${userId} has been unbound`)
    }
    return existed
  }

  /**
   * Clear all bound users
   */
  async clearAllBoundUsers(): Promise<void> {
    await this.ensureInitialized()
    this.boundUsers.clear()
    await this.saveBoundUsersToDisk()
    console.log('[Security] All bound users cleared')
  }

  /**
   * Check if there are any bound users
   */
  async hasBoundUsers(): Promise<boolean> {
    await this.ensureInitialized()
    return this.boundUsers.size > 0
  }
}

export const securityService = new SecurityService()
export type { BoundUser }
