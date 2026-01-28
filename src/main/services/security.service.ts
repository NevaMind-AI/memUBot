/**
 * Security Service
 * Manages security codes for user binding
 * Supports platform-specific bound users (Telegram, Discord, etc.)
 */

import * as fs from 'fs/promises'
import * as path from 'path'
import { app } from 'electron'

type Platform = 'telegram' | 'discord' | 'slack'

interface SecurityCode {
  code: string
  createdAt: number
  expiresAt: number
}

interface BoundUser {
  platform: Platform
  uniqueId: string // Platform-specific unique ID (as string for consistency)
  userId: number // Numeric ID for backwards compatibility
  username: string
  firstName?: string
  lastName?: string
  boundAt: number
}

const STORAGE_DIR = 'security-data'
const BOUND_USERS_FILE = 'bound-users-v2.json'

class SecurityService {
  private currentCode: SecurityCode | null = null
  // Map by platform -> Map by uniqueId -> BoundUser
  private boundUsersByPlatform: Map<Platform, Map<string, BoundUser>> = new Map()
  private storagePath: string
  private initialized = false
  private readonly CODE_EXPIRY_MS = 3 * 60 * 1000 // 3 minutes
  private readonly CODE_LENGTH = 6

  constructor() {
    this.storagePath = path.join(app.getPath('userData'), STORAGE_DIR)
    // Initialize platform maps
    this.boundUsersByPlatform.set('telegram', new Map())
    this.boundUsersByPlatform.set('discord', new Map())
    this.boundUsersByPlatform.set('slack', new Map())
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

      // Clear all maps
      this.boundUsersByPlatform.forEach((map) => map.clear())

      // Load users into their respective platform maps
      for (const user of users) {
        const platform = user.platform || 'telegram' // Default to telegram for old data
        const platformMap = this.boundUsersByPlatform.get(platform)
        if (platformMap) {
          platformMap.set(user.uniqueId || String(user.userId), user)
        }
      }

      console.log(
        `[Security] Loaded bound users: Telegram=${this.boundUsersByPlatform.get('telegram')?.size || 0}, Discord=${this.boundUsersByPlatform.get('discord')?.size || 0}, Slack=${this.boundUsersByPlatform.get('slack')?.size || 0}`
      )
    } catch {
      console.log('[Security] No existing bound users found')
    }
  }

  /**
   * Save bound users to disk
   */
  private async saveBoundUsersToDisk(): Promise<void> {
    const filePath = path.join(this.storagePath, BOUND_USERS_FILE)
    const allUsers: BoundUser[] = []

    this.boundUsersByPlatform.forEach((platformMap) => {
      allUsers.push(...Array.from(platformMap.values()))
    })

    await fs.writeFile(filePath, JSON.stringify(allUsers, null, 2), 'utf-8')
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
    lastName?: string,
    platform: Platform = 'telegram'
  ): Promise<{ success: boolean; error?: string }> {
    await this.ensureInitialized()

    const uniqueId = String(userId)

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

    // Get the platform map
    const platformMap = this.boundUsersByPlatform.get(platform)
    if (!platformMap) {
      return { success: false, error: 'Invalid platform.' }
    }

    // Check if user is already bound on this platform
    if (platformMap.has(uniqueId)) {
      // Consume the code anyway
      this.currentCode = null
      return { success: false, error: 'This account is already bound to this device.' }
    }

    // Bind the user
    const boundUser: BoundUser = {
      platform,
      uniqueId,
      userId,
      username,
      firstName,
      lastName,
      boundAt: now
    }
    platformMap.set(uniqueId, boundUser)

    // Save to disk
    await this.saveBoundUsersToDisk()

    // Consume the code (one-time use)
    this.currentCode = null

    console.log(`[Security] User ${username} (${uniqueId}) successfully bound to ${platform}`)
    return { success: true }
  }

  /**
   * Validate a security code and bind a user using string ID (for Discord snowflake IDs)
   * This avoids precision loss when converting large IDs to numbers
   */
  async validateAndBindByStringId(
    code: string,
    uniqueId: string,
    username: string,
    firstName?: string,
    lastName?: string,
    platform: Platform = 'discord'
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

    // Get the platform map
    const platformMap = this.boundUsersByPlatform.get(platform)
    if (!platformMap) {
      return { success: false, error: 'Invalid platform.' }
    }

    // Check if user is already bound on this platform
    if (platformMap.has(uniqueId)) {
      // Consume the code anyway
      this.currentCode = null
      return { success: false, error: 'This account is already bound to this device.' }
    }

    // Bind the user (use 0 for userId since we're using string uniqueId)
    const boundUser: BoundUser = {
      platform,
      uniqueId,
      userId: 0, // Not used for string ID platforms
      username,
      firstName,
      lastName,
      boundAt: now
    }
    platformMap.set(uniqueId, boundUser)

    // Save to disk
    await this.saveBoundUsersToDisk()

    // Consume the code (one-time use)
    this.currentCode = null

    console.log(`[Security] User ${username} (${uniqueId}) successfully bound to ${platform}`)
    return { success: true }
  }

  /**
   * Check if a user is authorized on a specific platform
   */
  async isAuthorized(userId: number, platform: Platform = 'telegram'): Promise<boolean> {
    await this.ensureInitialized()
    const platformMap = this.boundUsersByPlatform.get(platform)
    return platformMap?.has(String(userId)) || false
  }

  /**
   * Check if a user is authorized by string ID (for Discord)
   */
  async isAuthorizedByStringId(uniqueId: string, platform: Platform): Promise<boolean> {
    await this.ensureInitialized()
    const platformMap = this.boundUsersByPlatform.get(platform)
    return platformMap?.has(uniqueId) || false
  }

  /**
   * Get all bound users for a specific platform
   */
  async getBoundUsers(platform?: Platform): Promise<BoundUser[]> {
    await this.ensureInitialized()

    if (platform) {
      const platformMap = this.boundUsersByPlatform.get(platform)
      return platformMap ? Array.from(platformMap.values()) : []
    }

    // Return all users if no platform specified
    const allUsers: BoundUser[] = []
    this.boundUsersByPlatform.forEach((platformMap) => {
      allUsers.push(...Array.from(platformMap.values()))
    })
    return allUsers
  }

  /**
   * Remove a bound user from a specific platform
   */
  async removeBoundUser(userId: number, platform: Platform = 'telegram'): Promise<boolean> {
    await this.ensureInitialized()
    const platformMap = this.boundUsersByPlatform.get(platform)
    if (!platformMap) return false

    const uniqueId = String(userId)
    const existed = platformMap.has(uniqueId)
    platformMap.delete(uniqueId)
    if (existed) {
      await this.saveBoundUsersToDisk()
      console.log(`[Security] User ${userId} has been unbound from ${platform}`)
    }
    return existed
  }

  /**
   * Remove a bound user by string ID
   */
  async removeBoundUserByStringId(uniqueId: string, platform: Platform): Promise<boolean> {
    await this.ensureInitialized()
    const platformMap = this.boundUsersByPlatform.get(platform)
    if (!platformMap) return false

    const existed = platformMap.has(uniqueId)
    platformMap.delete(uniqueId)
    if (existed) {
      await this.saveBoundUsersToDisk()
      console.log(`[Security] User ${uniqueId} has been unbound from ${platform}`)
    }
    return existed
  }

  /**
   * Clear all bound users for a specific platform
   */
  async clearBoundUsers(platform?: Platform): Promise<void> {
    await this.ensureInitialized()

    if (platform) {
      const platformMap = this.boundUsersByPlatform.get(platform)
      if (platformMap) {
        platformMap.clear()
      }
      console.log(`[Security] All ${platform} bound users cleared`)
    } else {
      // Clear all platforms
      this.boundUsersByPlatform.forEach((map) => map.clear())
      console.log('[Security] All bound users cleared')
    }

    await this.saveBoundUsersToDisk()
  }

  /**
   * Check if there are any bound users for a platform
   */
  async hasBoundUsers(platform?: Platform): Promise<boolean> {
    await this.ensureInitialized()

    if (platform) {
      const platformMap = this.boundUsersByPlatform.get(platform)
      return (platformMap?.size || 0) > 0
    }

    // Check all platforms
    const platforms = Array.from(this.boundUsersByPlatform.values())
    for (const platformMap of platforms) {
      if (platformMap.size > 0) return true
    }
    return false
  }
}

export const securityService = new SecurityService()
export type { BoundUser, Platform }
