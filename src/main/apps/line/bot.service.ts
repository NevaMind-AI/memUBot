import { lineStorage } from './storage'
import { getSetting } from '../../config/settings.config'
import { agentService } from '../../services/agent.service'
import { infraService } from '../../services/infra.service'
import { securityService } from '../../services/security.service'
import { appEvents } from '../../events'
import type { BotStatus, AppMessage } from '../types'
import type { StoredLineMessage } from './types'

// LINE Bot SDK
import { Client, WebhookEvent, MessageAPIResponseBase, TextMessage, ImageMessage, StickerMessage, LocationMessage, FlexMessage } from '@line/bot-sdk'

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
  private client: Client | null = null

  /**
   * Connect to Line (initialize client)
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

      // Initialize LINE client
      this.client = new Client({
        channelAccessToken,
        channelSecret
      })

      this.status = {
        platform: 'line',
        isConnected: true
      }

      appEvents.emitLineStatusChanged(this.status)
      console.log('[Line] Connected successfully')
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
    this.client = null
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

    // Publish incoming message event to infraService
    infraService.publish('message:incoming', {
      platform: 'line',
      timestamp: Math.floor(event.timestamp / 1000),
      message: { role: 'user', content: text || '' },
      metadata: {
        userId,
        chatId: sourceId,
        messageId: event.message.id
      }
    })

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

    try {
      // Check if message should be consumed by other services (e.g., proactive service)
      if (await infraService.tryConsumeUserInput(userMessage, 'line')) {
        console.log('[Line] Message consumed by another service, returning silently')
        return
      }

      const response = await agentService.processMessage(userMessage, 'line')

      // Check if rejected due to processing lock
      if (!response.success && response.busyWith) {
        console.log(`[Line] Agent is busy with ${response.busyWith}`)
        if (this.client && replyToken) {
          await this.client.replyMessage(replyToken, {
            type: 'text',
            text: response.message || 'I am currently busy with another task. Please try again later.'
          })
        }
        return
      }

      if (response.success && response.message) {
        console.log('[Line] Agent response:', response.message.substring(0, 100) + '...')
        
        // Send reply via LINE client
        if (this.client && replyToken) {
          await this.client.replyMessage(replyToken, {
            type: 'text',
            text: response.message
          })
        }

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

        // Publish outgoing message event to infraService
        infraService.publish('message:outgoing', {
          platform: 'line',
          timestamp: botReply.date,
          message: { role: 'assistant', content: response.message },
          metadata: {
            messageId: botReply.messageId
          }
        })
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
    if (!this.client) {
      return { success: false, error: 'Bot not connected' }
    }

    try {
      const message: TextMessage = {
        type: 'text',
        text
      }
      await this.client.pushMessage(to, message)
      return { success: true }
    } catch (error) {
      console.error('[Line] Error sending text:', error)
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  }

  /**
   * Send an image
   */
  async sendImage(
    to: string,
    originalContentUrl: string,
    previewImageUrl: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.client) {
      return { success: false, error: 'Bot not connected' }
    }

    try {
      const message: ImageMessage = {
        type: 'image',
        originalContentUrl,
        previewImageUrl
      }
      await this.client.pushMessage(to, message)
      return { success: true }
    } catch (error) {
      console.error('[Line] Error sending image:', error)
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  }

  /**
   * Send a sticker
   */
  async sendSticker(
    to: string,
    packageId: string,
    stickerId: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.client) {
      return { success: false, error: 'Bot not connected' }
    }

    try {
      const message: StickerMessage = {
        type: 'sticker',
        packageId,
        stickerId
      }
      await this.client.pushMessage(to, message)
      return { success: true }
    } catch (error) {
      console.error('[Line] Error sending sticker:', error)
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
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
    if (!this.client) {
      return { success: false, error: 'Bot not connected' }
    }

    try {
      const message: LocationMessage = {
        type: 'location',
        title,
        address,
        latitude,
        longitude
      }
      await this.client.pushMessage(to, message)
      return { success: true }
    } catch (error) {
      console.error('[Line] Error sending location:', error)
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  }

  /**
   * Send a flex message (rich card)
   */
  async sendFlexMessage(
    to: string,
    altText: string,
    contents: unknown
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.client) {
      return { success: false, error: 'Bot not connected' }
    }

    try {
      const message: FlexMessage = {
        type: 'flex',
        altText,
        contents: contents as FlexMessage['contents']
      }
      await this.client.pushMessage(to, message)
      return { success: true }
    } catch (error) {
      console.error('[Line] Error sending flex message:', error)
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  }
}

// Export singleton instance
export const lineBotService = new LineBotService()
