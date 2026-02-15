import { whatsappStorage } from './storage'
import { agentService } from '../../services/agent.service'
import { infraService } from '../../services/infra.service'
import { securityService } from '../../services/security.service'
import { trackUserMessage } from '../../services/analytics.service'
import { appEvents } from '../../events'
import type { BotStatus, AppMessage } from '../types'
import type { StoredWhatsAppMessage, WhatsAppConnectionStatus } from './types'

// Note: WhatsApp Web.js or Baileys would be imported here
// For now, we create a placeholder implementation that can be connected later

/**
 * WhatsAppBotService manages WhatsApp connection and message handling
 * Uses WhatsApp Web protocol for messaging
 */
export class WhatsAppBotService {
  private status: BotStatus = {
    platform: 'whatsapp',
    isConnected: false
  }
  private connectionStatus: WhatsAppConnectionStatus = {
    state: 'disconnected'
  }
  private currentChatId: string | null = null

  /**
   * Connect to WhatsApp
   * Note: Requires QR code scanning for authentication
   */
  async connect(): Promise<void> {
    try {
      console.log('[WhatsApp] Starting connection...')

      // Initialize storage
      await whatsappStorage.initialize()
      console.log('[WhatsApp] Storage initialized')

      // TODO: Implement WhatsApp Web.js or Baileys client initialization
      // This would involve:
      // 1. Creating client with session stored in whatsappStorage.getSessionPath()
      // 2. Generating QR code for authentication
      // 3. Setting up message handlers

      this.connectionStatus = {
        state: 'connecting'
      }

      // Emit status (placeholder - would be updated after QR scan)
      this.status = {
        platform: 'whatsapp',
        isConnected: false,
        error: 'WhatsApp integration requires additional setup. Please configure WhatsApp Web credentials.'
      }

      appEvents.emitWhatsAppStatusChanged(this.status)
      console.log('[WhatsApp] Connection requires QR code authentication')
    } catch (error) {
      console.error('[WhatsApp] Connection error:', error)
      this.status = {
        platform: 'whatsapp',
        isConnected: false,
        error: error instanceof Error ? error.message : String(error)
      }
      appEvents.emitWhatsAppStatusChanged(this.status)
      throw error
    }
  }

  /**
   * Disconnect from WhatsApp
   */
  async disconnect(): Promise<void> {
    // TODO: Implement client disconnection
    this.status = {
      platform: 'whatsapp',
      isConnected: false
    }
    this.connectionStatus = {
      state: 'disconnected'
    }
    appEvents.emitWhatsAppStatusChanged(this.status)
    console.log('[WhatsApp] Disconnected')
  }

  /**
   * Get current QR code for authentication
   */
  getQRCode(): string | undefined {
    return this.connectionStatus.qrCode
  }

  /**
   * Get connection status
   */
  getConnectionStatus(): WhatsAppConnectionStatus {
    return this.connectionStatus
  }

  /**
   * Handle incoming message
   */
  private async handleIncomingMessage(
    messageId: string,
    chatId: string,
    fromId: string,
    fromName: string,
    text: string,
    timestamp: number
  ): Promise<void> {
    console.log('[WhatsApp] Processing message...')

    // Check if user is authorized
    const isAuthorized = await securityService.isAuthorizedByStringId(fromId, 'whatsapp')
    if (!isAuthorized) {
      console.log(`[WhatsApp] Unauthorized user ${fromName}, ignoring message`)
      return
    }

    // Set current chat for tool calls
    this.currentChatId = chatId

    // Store incoming message
    const storedMsg: StoredWhatsAppMessage = {
      messageId,
      chatId,
      fromId,
      fromName,
      text,
      date: timestamp,
      isFromBot: false
    }
    await whatsappStorage.storeMessage(storedMsg)
    console.log('[WhatsApp] Message stored:', storedMsg.messageId)

    // Track user message event for analytics
    trackUserMessage(text, 'whatsapp', timestamp * 1000)

    // Emit event for new message
    const appMessage = this.convertToAppMessage(storedMsg)
    appEvents.emitWhatsAppNewMessage(appMessage)

    // Publish incoming message event to infraService
    infraService.publish('message:incoming', {
      platform: 'whatsapp',
      timestamp,
      message: { role: 'user', content: text || '' },
      metadata: {
        userId: fromId,
        chatId,
        messageId
      }
    })

    // Process with Agent and reply
    if (text) {
      await this.processWithAgentAndReply(chatId, text)
    }
  }

  /**
   * Process message with Agent and send reply
   */
  private async processWithAgentAndReply(chatId: string, userMessage: string): Promise<void> {
    console.log('[WhatsApp] Sending to Agent:', userMessage.substring(0, 50) + '...')

    try {
      // Check if message should be consumed by other services (e.g., proactive service)
      if (await infraService.tryConsumeUserInput(userMessage, 'whatsapp')) {
        console.log('[WhatsApp] Message consumed by another service, returning silently')
        return
      }

      const response = await agentService.processMessage(userMessage, 'whatsapp')

      // Check if rejected due to processing lock
      if (!response.success && response.busyWith) {
        console.log(`[WhatsApp] Agent is busy with ${response.busyWith}`)
        // TODO: Send busy message to WhatsApp when client is implemented
        // response.message contains the localized rejection text
        return
      }

      if (response.success && response.message) {
        console.log('[WhatsApp] Agent response:', response.message.substring(0, 100) + '...')
        // TODO: Send message via WhatsApp client

        // Store bot's reply
        const botReply: StoredWhatsAppMessage = {
          messageId: `bot-${Date.now()}`,
          chatId,
          fromId: 'bot',
          fromName: 'Bot',
          text: response.message,
          date: Math.floor(Date.now() / 1000),
          isFromBot: true
        }
        await whatsappStorage.storeMessage(botReply)

        // Emit event for bot's reply
        const appMessage = this.convertToAppMessage(botReply)
        appEvents.emitWhatsAppNewMessage(appMessage)

        // Publish outgoing message event to infraService
        infraService.publish('message:outgoing', {
          platform: 'whatsapp',
          timestamp: botReply.date,
          message: { role: 'assistant', content: response.message },
          metadata: {
            messageId: botReply.messageId
          }
        })
      }
    } catch (error) {
      console.error('[WhatsApp] Error processing with Agent:', error)
    }
  }

  /**
   * Get bot status
   */
  getStatus(): BotStatus {
    return this.status
  }

  /**
   * Get current chat ID
   */
  getCurrentChatId(): string | null {
    return this.currentChatId
  }

  /**
   * Get all messages
   */
  async getMessages(limit = 200): Promise<AppMessage[]> {
    const messages = await whatsappStorage.getMessages(limit)
    return messages.map((msg) => this.convertToAppMessage(msg))
  }

  /**
   * Convert stored message to AppMessage
   */
  private convertToAppMessage(msg: StoredWhatsAppMessage): AppMessage {
    return {
      id: msg.messageId,
      platform: 'whatsapp',
      chatId: msg.chatId,
      senderId: msg.fromId,
      senderName: msg.fromPushName || msg.fromName,
      content: msg.text || '',
      timestamp: new Date(msg.date * 1000),
      isFromBot: msg.isFromBot,
      replyToId: msg.replyToMessageId
    }
  }

  // ========== Public Media Sending Methods ==========

  /**
   * Send a text message
   */
  async sendText(
    chatId: string,
    text: string
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!this.status.isConnected) {
      return { success: false, error: 'Bot not connected' }
    }
    // TODO: Implement actual sending via WhatsApp client
    return { success: false, error: 'WhatsApp sending not yet implemented' }
  }

  /**
   * Send an image
   */
  async sendImage(
    chatId: string,
    imagePath: string,
    caption?: string
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!this.status.isConnected) {
      return { success: false, error: 'Bot not connected' }
    }
    // TODO: Implement actual sending via WhatsApp client
    return { success: false, error: 'WhatsApp sending not yet implemented' }
  }

  /**
   * Send a document
   */
  async sendDocument(
    chatId: string,
    documentPath: string,
    filename?: string
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!this.status.isConnected) {
      return { success: false, error: 'Bot not connected' }
    }
    // TODO: Implement actual sending via WhatsApp client
    return { success: false, error: 'WhatsApp sending not yet implemented' }
  }

  /**
   * Send a location
   */
  async sendLocation(
    chatId: string,
    latitude: number,
    longitude: number,
    description?: string
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!this.status.isConnected) {
      return { success: false, error: 'Bot not connected' }
    }
    // TODO: Implement actual sending via WhatsApp client
    return { success: false, error: 'WhatsApp sending not yet implemented' }
  }
}

// Export singleton instance
export const whatsappBotService = new WhatsAppBotService()
