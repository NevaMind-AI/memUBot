/**
 * Analytics Service - Main Process
 * Sends events to renderer process which uses Grafana Faro Web SDK
 */

import { app, BrowserWindow, ipcMain } from 'electron'
import { randomUUID } from 'crypto'
import * as fs from 'fs/promises'
import * as path from 'path'
import { settingsManager } from '../config/settings.config'

const USER_ID_FILE = 'user_id.txt'

/**
 * Common parameters for all events
 */
export interface CommonParams {
  user_id: string
  app_version: string
  platform: string
  arch: string
  os_version: string
  locale: string
  platforms_configured: string
  llm_provider: string
}

/**
 * Analytics Service class - sends events to renderer via IPC
 */
class AnalyticsService {
  private commonParams: CommonParams | null = null
  private initialized = false

  /**
   * Initialize the service - load common params and setup IPC handlers
   */
  async initialize(): Promise<void> {
    if (this.initialized) return

    try {
      // Load or generate user_id
      const userId = await this.loadOrGenerateUserId()
      console.log('[Analytics] User ID:', userId)

      // Load settings and build common params
      const settings = await settingsManager.getSettings()
      
      // Detect configured platforms
      const platformsConfigured = this.detectConfiguredPlatforms(settings)

      // Build common params (as string record for Faro attributes)
      this.commonParams = {
        user_id: userId,
        app_version: app.getVersion(),
        platform: process.platform,
        arch: process.arch,
        os_version: process.getSystemVersion(),
        locale: settings.language || app.getLocale(),
        platforms_configured: platformsConfigured.join(','),
        llm_provider: settings.llmProvider
      }

      // Setup IPC handler for renderer to get config
      this.setupIpcHandlers()

      this.initialized = true
      console.log('[Analytics] Service initialized with params:', {
        ...this.commonParams,
        user_id: this.commonParams.user_id.slice(0, 8) + '...'
      })
    } catch (error) {
      console.error('[Analytics] Failed to initialize:', error)
    }
  }

  /**
   * Setup IPC handlers
   */
  private setupIpcHandlers(): void {
    // Handler for renderer to get analytics config
    ipcMain.handle('analytics:get-config', () => {
      return {
        userId: this.commonParams?.user_id || '',
        attributes: this.commonParams ? { ...this.commonParams } : {}
      }
    })
  }

  /**
   * Detect which platforms are configured based on settings
   */
  private detectConfiguredPlatforms(settings: Awaited<ReturnType<typeof settingsManager.getSettings>>): string[] {
    const platforms: string[] = []

    if (settings.telegramBotToken) platforms.push('telegram')
    if (settings.discordBotToken) platforms.push('discord')
    if (settings.slackBotToken && settings.slackAppToken) platforms.push('slack')
    if (settings.lineChannelAccessToken && settings.lineChannelSecret) platforms.push('line')
    if (settings.feishuAppId && settings.feishuAppSecret) platforms.push('feishu')
    if (settings.whatsappEnabled) platforms.push('whatsapp')

    return platforms
  }

  /**
   * Load existing user_id or generate a new one
   */
  private async loadOrGenerateUserId(): Promise<string> {
    const userDataPath = app.getPath('userData')
    const userIdPath = path.join(userDataPath, USER_ID_FILE)

    try {
      const existingId = await fs.readFile(userIdPath, 'utf-8')
      const trimmedId = existingId.trim()
      if (trimmedId) {
        return trimmedId
      }
    } catch {
      // File doesn't exist, will generate new one
    }

    const newUserId = randomUUID()

    try {
      await fs.writeFile(userIdPath, newUserId, 'utf-8')
      console.log('[Analytics] Generated new user_id:', newUserId)
    } catch (error) {
      console.error('[Analytics] Failed to save user_id:', error)
    }

    return newUserId
  }

  /**
   * Get current user_id
   */
  getUserId(): string {
    return this.commonParams?.user_id || ''
  }

  /**
   * Get all common params
   */
  getCommonParams(): CommonParams | null {
    return this.commonParams
  }

  /**
   * Send event to renderer process via IPC
   */
  private sendToRenderer(eventName: string, attributes?: Record<string, string>): void {
    const windows = BrowserWindow.getAllWindows()
    if (windows.length === 0) {
      console.log('[Analytics] No window available, event queued:', eventName)
      return
    }

    const fullAttributes = {
      ...this.commonParams,
      ...attributes
    }

    windows.forEach(win => {
      if (!win.isDestroyed()) {
        win.webContents.send('analytics:track', {
          eventName,
          attributes: fullAttributes
        })
      }
    })

    console.log('[Analytics] Event sent to renderer:', eventName)
  }

  /**
   * Track an event
   */
  track(eventName: string, domain: string, attributes?: Record<string, string>): void {
    if (!this.initialized) return

    this.sendToRenderer(eventName, {
      event_domain: domain,
      ...attributes
    })
  }

  /**
   * Track app start event
   */
  trackAppStart(): void {
    this.track('app_start', 'lifecycle')
  }

  /**
   * Track app error event
   */
  trackAppError(error: string): void {
    this.track('app_error', 'lifecycle', { error })
  }

  /**
   * Track user message event (message sent from user to bot)
   */
  trackUserMessage(query: string, platform: string, sendTime?: string | number): void {
    const sendTimeStr = sendTime 
      ? (typeof sendTime === 'number' ? new Date(sendTime).toISOString() : sendTime)
      : new Date().toISOString()
    
    this.track('user_message', 'message', {
      query,
      msg_platform: platform,
      send_time: sendTimeStr
    })
  }

  /**
   * Track platform connection events
   */
  trackPlatformEvent(
    event: 'platform_connect' | 'platform_disconnect' | 'platform_error',
    platform: string,
    attributes?: Record<string, string>
  ): void {
    this.track(event, 'platform', { msg_platform: platform, ...attributes })
  }

  /**
   * Track message events
   */
  trackMessageEvent(
    event: 'message_received' | 'message_sent' | 'message_error',
    platform: string,
    attributes?: Record<string, string>
  ): void {
    this.track(event, 'message', { msg_platform: platform, ...attributes })
  }

  /**
   * Shutdown the service
   */
  async shutdown(): Promise<void> {
    console.log('[Analytics] Service shutdown')
  }
}

// Export singleton instance
export const analyticsService = new AnalyticsService()

// Convenience function exports
export const track = (eventName: string, domain: string, attributes?: Record<string, string>): void => {
  analyticsService.track(eventName, domain, attributes)
}

export const trackAppStart = (): void => {
  analyticsService.trackAppStart()
}

export const trackAppError = (error: string): void => {
  analyticsService.trackAppError(error)
}

export const trackUserMessage = (query: string, platform: string, sendTime?: string | number): void => {
  analyticsService.trackUserMessage(query, platform, sendTime)
}

export const trackPlatformEvent = (
  event: 'platform_connect' | 'platform_disconnect' | 'platform_error',
  platform: string,
  attributes?: Record<string, string>
): void => {
  analyticsService.trackPlatformEvent(event, platform, attributes)
}

export const trackMessageEvent = (
  event: 'message_received' | 'message_sent' | 'message_error',
  platform: string,
  attributes?: Record<string, string>
): void => {
  analyticsService.trackMessageEvent(event, platform, attributes)
}
