import { slackStorage } from './storage'
import { getSetting } from '../../config/settings.config'
import { agentService } from '../../services/agent.service'
import { securityService } from '../../services/security.service'
import { appEvents } from '../../events'
import type { BotStatus, AppMessage } from '../types'
import type { StoredSlackMessage, SlackWorkspace } from './types'

// Note: @slack/bolt would be imported here for actual implementation
// import { App as SlackApp } from '@slack/bolt'

/**
 * SlackBotService manages Slack bot connection and message handling
 * Uses Slack Bolt SDK for event handling
 */
export class SlackBotService {
  private status: BotStatus = {
    platform: 'slack',
    isConnected: false
  }
  private currentChannelId: string | null = null
  private workspace: SlackWorkspace | null = null

  /**
   * Connect to Slack
   */
  async connect(): Promise<void> {
    try {
      console.log('[Slack] Starting connection...')

      // Get tokens from settings
      const botToken = await getSetting('slackBotToken')
      const appToken = await getSetting('slackAppToken')

      if (!botToken) {
        throw new Error('Slack Bot Token not configured. Please set it in Settings.')
      }

      // Initialize storage
      await slackStorage.initialize()
      console.log('[Slack] Storage initialized')

      // TODO: Implement Slack Bolt app initialization
      // This would involve:
      // 1. Creating Slack App with bot token and app token (for socket mode)
      // 2. Setting up event listeners for messages
      // 3. Starting the app

      this.status = {
        platform: 'slack',
        isConnected: false,
        error: 'Slack integration requires Bot Token and App Token. Please configure in Settings.'
      }

      appEvents.emitSlackStatusChanged(this.status)
      console.log('[Slack] Connection setup requires additional configuration')
    } catch (error) {
      console.error('[Slack] Connection error:', error)
      this.status = {
        platform: 'slack',
        isConnected: false,
        error: error instanceof Error ? error.message : String(error)
      }
      appEvents.emitSlackStatusChanged(this.status)
      throw error
    }
  }

  /**
   * Disconnect from Slack
   */
  async disconnect(): Promise<void> {
    // TODO: Implement app disconnection
    this.status = {
      platform: 'slack',
      isConnected: false
    }
    this.workspace = null
    appEvents.emitSlackStatusChanged(this.status)
    console.log('[Slack] Disconnected')
  }

  /**
   * Handle incoming message
   */
  private async handleIncomingMessage(
    messageId: string,
    channelId: string,
    fromId: string,
    fromUsername: string,
    text: string,
    timestamp: number,
    threadTs?: string
  ): Promise<void> {
    console.log('[Slack] Processing message...')

    // Check if user is authorized
    const isAuthorized = await securityService.isAuthorizedByStringId(fromId, 'slack')
    if (!isAuthorized) {
      console.log(`[Slack] Unauthorized user ${fromUsername}, ignoring message`)
      return
    }

    // Set current channel for tool calls
    this.currentChannelId = channelId

    // Store incoming message
    const storedMsg: StoredSlackMessage = {
      messageId,
      channelId,
      threadTs,
      fromId,
      fromUsername,
      text,
      date: timestamp,
      isFromBot: false
    }
    await slackStorage.storeMessage(storedMsg)
    console.log('[Slack] Message stored:', storedMsg.messageId)

    // Emit event for new message
    const appMessage = this.convertToAppMessage(storedMsg)
    appEvents.emitSlackNewMessage(appMessage)

    // Process with Agent and reply
    if (text) {
      await this.processWithAgentAndReply(channelId, text, threadTs)
    }
  }

  /**
   * Process message with Agent and send reply
   */
  private async processWithAgentAndReply(
    channelId: string,
    userMessage: string,
    threadTs?: string
  ): Promise<void> {
    console.log('[Slack] Sending to Agent:', userMessage.substring(0, 50) + '...')

    if (agentService.isProcessing()) {
      console.log('[Slack] Agent is busy, ignoring message')
      return
    }

    try {
      const response = await agentService.processMessage(userMessage, 'slack')

      if (response.success && response.message) {
        console.log('[Slack] Agent response:', response.message.substring(0, 100) + '...')
        // TODO: Send message via Slack client

        // Store bot's reply
        const botReply: StoredSlackMessage = {
          messageId: `bot-${Date.now()}`,
          channelId,
          threadTs,
          fromId: 'bot',
          fromUsername: 'Bot',
          text: response.message,
          date: Math.floor(Date.now() / 1000),
          isFromBot: true
        }
        await slackStorage.storeMessage(botReply)

        // Emit event for bot's reply
        const appMessage = this.convertToAppMessage(botReply)
        appEvents.emitSlackNewMessage(appMessage)
      }
    } catch (error) {
      console.error('[Slack] Error processing with Agent:', error)
    }
  }

  /**
   * Get bot status
   */
  getStatus(): BotStatus {
    return this.status
  }

  /**
   * Get current channel ID
   */
  getCurrentChannelId(): string | null {
    return this.currentChannelId
  }

  /**
   * Get workspace info
   */
  getWorkspace(): SlackWorkspace | null {
    return this.workspace
  }

  /**
   * Get all messages
   */
  async getMessages(limit = 200): Promise<AppMessage[]> {
    const messages = await slackStorage.getMessages(limit)
    return messages.map((msg) => this.convertToAppMessage(msg))
  }

  /**
   * Convert stored message to AppMessage
   */
  private convertToAppMessage(msg: StoredSlackMessage): AppMessage {
    return {
      id: msg.messageId,
      platform: 'slack',
      chatId: msg.channelId,
      senderId: msg.fromId,
      senderName: msg.fromDisplayName || msg.fromUsername,
      content: msg.text || '',
      timestamp: new Date(msg.date * 1000),
      isFromBot: msg.isFromBot,
      replyToId: msg.replyToMessageId
    }
  }

  // ========== Public Messaging Methods ==========

  /**
   * Send a text message
   */
  async sendText(
    channelId: string,
    text: string,
    threadTs?: string
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!this.status.isConnected) {
      return { success: false, error: 'Bot not connected' }
    }
    // TODO: Implement actual sending via Slack client
    return { success: false, error: 'Slack sending not yet implemented' }
  }

  /**
   * Send a message with blocks (rich formatting)
   */
  async sendBlocks(
    channelId: string,
    blocks: unknown[],
    text?: string,
    threadTs?: string
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!this.status.isConnected) {
      return { success: false, error: 'Bot not connected' }
    }
    // TODO: Implement actual sending via Slack client
    return { success: false, error: 'Slack sending not yet implemented' }
  }

  /**
   * Upload a file
   */
  async uploadFile(
    channelId: string,
    filePath: string,
    filename?: string,
    title?: string,
    initialComment?: string
  ): Promise<{ success: boolean; fileId?: string; error?: string }> {
    if (!this.status.isConnected) {
      return { success: false, error: 'Bot not connected' }
    }
    // TODO: Implement actual file upload via Slack client
    return { success: false, error: 'Slack sending not yet implemented' }
  }

  /**
   * Add a reaction to a message
   */
  async addReaction(
    channelId: string,
    messageTs: string,
    emoji: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.status.isConnected) {
      return { success: false, error: 'Bot not connected' }
    }
    // TODO: Implement actual reaction via Slack client
    return { success: false, error: 'Slack sending not yet implemented' }
  }
}

// Export singleton instance
export const slackBotService = new SlackBotService()
