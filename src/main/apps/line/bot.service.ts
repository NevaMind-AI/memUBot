import { lineStorage } from './storage'
import { getSetting } from '../../config/settings.config'
import { agentService } from '../../services/agent.service'
import { securityService } from '../../services/security.service'
import { appEvents } from '../../events'
import type { BotStatus, AppMessage } from '../types'
import type { StoredLineMessage } from './types'

// Note: @line/bot-sdk would be imported here for actual implementation
// import { Client, WebhookEvent, TextMessage } from '@line/bot-sdk'

/**
 * LineBotService manages Line bot connection and message handling
 * Uses Line Messaging API via webhook
 */
export class LineBotService {
  private status: BotStatus = {
    platform: 'line',
    isConnected: false
  }
  private currentSourceId: string | null = null
  private currentSourceType: 'user' | 'group' | 'room' | null = null

  /**
   * Connect to Line (start webhook server)
   */
  async connect(): Promise<void> {
    try {
      console.log('[Line] Starting connection...')

      // Get credentials from settings
      const channelAccessToken = await getSetting('lineChannelAccessToken')
      const channelSecret = await getSetting('lineChannelSecret')

      if (!channelAccessToken || !channelSecret) {
        throw new Error('Line Channel Access Token and Channel Secret not configured. Please set them in Settings.')
      }

      // Initialize storage
      await lineStorage.initialize()
      console.log('[Line] Storage initialized')

      // TODO: Implement Line client and webhook server
      // This would involve:
      // 1. Creating Line client with channel access token and channel secret
      // 2. Setting up Express webhook endpoint
      // 3. Handling webhook events

      this.status = {
        platform: 'line',
        isConnected: false,
        error: 'Line integration requires Channel Access Token, Channel Secret, and webhook URL. Please configure in Settings.'
      }

      appEvents.emitLineStatusChanged(this.status)
      console.log('[Line] Connection setup requires additional configuration')
    } catch (error) {
      console.error('[Line] Connection error:', error)
      this.status = {
        platform: 'line',
        isConnected: false,
        error: error instanceof Error ? error.message : String(error)
      }
      appEvents.emitLineStatusChanged(this.status)
      throw error
    }
  }

  /**
   * Disconnect from Line
   */
  async disconnect(): Promise<void> {
    // TODO: Implement webhook server shutdown
    this.status = {
      platform: 'line',
      isConnected: false
    }
    appEvents.emitLineStatusChanged(this.status)
    console.log('[Line] Disconnected')
  }

  /**
   * Handle incoming webhook event
   */
  async handleWebhookEvent(event: {
    type: string
    replyToken?: string
    source: { type: 'user' | 'group' | 'room'; userId?: string; groupId?: string; roomId?: string }
    message?: { id: string; type: string; text?: string }
    timestamp: number
  }): Promise<void> {
    if (event.type !== 'message' || !event.message) {
      return
    }

    const userId = event.source.userId
    if (!userId) {
      console.log('[Line] No user ID in event')
      return
    }

    // Check authorization
    const isAuthorized = await securityService.isAuthorizedByStringId(userId, 'line')
    if (!isAuthorized) {
      console.log(`[Line] Unauthorized user ${userId}`)
      return
    }

    // Determine source ID and type
    let sourceId: string
    let sourceType: 'user' | 'group' | 'room' = event.source.type

    if (event.source.type === 'group' && event.source.groupId) {
      sourceId = event.source.groupId
    } else if (event.source.type === 'room' && event.source.roomId) {
      sourceId = event.source.roomId
    } else {
      sourceId = userId
      sourceType = 'user'
    }

    // Set current source for tool calls
    this.currentSourceId = sourceId
    this.currentSourceType = sourceType

    const text = event.message.text || ''

    // Store message
    const storedMsg: StoredLineMessage = {
      messageId: event.message.id,
      replyToken: event.replyToken,
      sourceType,
      sourceId,
      userId,
      text,
      date: Math.floor(event.timestamp / 1000),
      isFromBot: false
    }
    await lineStorage.storeMessage(storedMsg)

    // Emit event
    const appMessage = this.convertToAppMessage(storedMsg)
    appEvents.emitLineNewMessage(appMessage)

    // Process with Agent
    if (text && event.replyToken) {
      await this.processWithAgentAndReply(event.replyToken, sourceType, sourceId, text)
    }
  }

  /**
   * Process message with Agent and send reply
   */
  private async processWithAgentAndReply(
    replyToken: string,
    sourceType: 'user' | 'group' | 'room',
    sourceId: string,
    userMessage: string
  ): Promise<void> {
    console.log('[Line] Sending to Agent:', userMessage.substring(0, 50) + '...')

    if (agentService.isProcessing()) {
      console.log('[Line] Agent is busy')
      return
    }

    try {
      const response = await agentService.processMessage(userMessage, 'line')

      if (response.success && response.message) {
        console.log('[Line] Agent response:', response.message.substring(0, 100) + '...')
        // TODO: Send reply via Line client using replyToken

        // Store bot's reply
        const botReply: StoredLineMessage = {
          messageId: `bot-${Date.now()}`,
          sourceType,
          sourceId,
          userId: 'bot',
          text: response.message,
          date: Math.floor(Date.now() / 1000),
          isFromBot: true
        }
        await lineStorage.storeMessage(botReply)

        // Emit event
        const appMessage = this.convertToAppMessage(botReply)
        appEvents.emitLineNewMessage(appMessage)
      }
    } catch (error) {
      console.error('[Line] Error processing with Agent:', error)
    }
  }

  /**
   * Get bot status
   */
  getStatus(): BotStatus {
    return this.status
  }

  /**
   * Get current source info
   */
  getCurrentSource(): { id: string | null; type: 'user' | 'group' | 'room' | null } {
    return {
      id: this.currentSourceId,
      type: this.currentSourceType
    }
  }

  /**
   * Get all messages
   */
  async getMessages(limit = 200): Promise<AppMessage[]> {
    const messages = await lineStorage.getMessages(limit)
    return messages.map((msg) => this.convertToAppMessage(msg))
  }

  /**
   * Convert stored message to AppMessage
   */
  private convertToAppMessage(msg: StoredLineMessage): AppMessage {
    return {
      id: msg.messageId,
      platform: 'line',
      chatId: msg.sourceId,
      senderId: msg.userId,
      senderName: msg.userName || msg.userId,
      content: msg.text || '',
      timestamp: new Date(msg.date * 1000),
      isFromBot: msg.isFromBot,
      replyToId: msg.replyToMessageId
    }
  }

  // ========== Public Messaging Methods ==========

  /**
   * Send a text message (push message)
   */
  async sendText(
    to: string,
    text: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.status.isConnected) {
      return { success: false, error: 'Bot not connected' }
    }
    // TODO: Implement push message via Line client
    return { success: false, error: 'Line sending not yet implemented' }
  }

  /**
   * Send an image
   */
  async sendImage(
    to: string,
    originalContentUrl: string,
    previewImageUrl: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.status.isConnected) {
      return { success: false, error: 'Bot not connected' }
    }
    // TODO: Implement image sending via Line client
    return { success: false, error: 'Line sending not yet implemented' }
  }

  /**
   * Send a sticker
   */
  async sendSticker(
    to: string,
    packageId: string,
    stickerId: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.status.isConnected) {
      return { success: false, error: 'Bot not connected' }
    }
    // TODO: Implement sticker sending via Line client
    return { success: false, error: 'Line sending not yet implemented' }
  }

  /**
   * Send a location
   */
  async sendLocation(
    to: string,
    title: string,
    address: string,
    latitude: number,
    longitude: number
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.status.isConnected) {
      return { success: false, error: 'Bot not connected' }
    }
    // TODO: Implement location sending via Line client
    return { success: false, error: 'Line sending not yet implemented' }
  }

  /**
   * Send a flex message (rich card)
   */
  async sendFlexMessage(
    to: string,
    altText: string,
    contents: unknown
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.status.isConnected) {
      return { success: false, error: 'Bot not connected' }
    }
    // TODO: Implement flex message via Line client
    return { success: false, error: 'Line sending not yet implemented' }
  }
}

// Export singleton instance
export const lineBotService = new LineBotService()
