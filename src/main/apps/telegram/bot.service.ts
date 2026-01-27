import TelegramBot from 'node-telegram-bot-api'
import { SocksProxyAgent } from 'socks-proxy-agent'
import { telegramStorage } from './storage'
import { loadProxyConfig, buildProxyUrl } from '../../config/proxy.config'
import { getSetting } from '../../config/settings.config'
import { agentService } from '../../services/agent.service'
import { appEvents } from '../../events'
import type { BotStatus, AppMessage } from '../types'
import type { StoredTelegramMessage, TelegramMessage } from './types'

/**
 * TelegramBotService manages the Telegram bot connection and message handling
 * Single-user mode: all messages stored together without session separation
 */
export class TelegramBotService {
  private bot: TelegramBot | null = null
  private status: BotStatus = {
    platform: 'telegram',
    isConnected: false
  }
  private pollingActive = false
  private lastUpdateId = 0
  private pollingCount = 0

  /**
   * Connect to Telegram
   */
  async connect(): Promise<void> {
    try {
      console.log('[Telegram] Starting connection...')

      // Get bot token from settings
      const botToken = await getSetting('telegramBotToken')
      if (!botToken) {
        throw new Error('Telegram Bot Token not configured. Please set it in Settings.')
      }

      // Initialize storage
      await telegramStorage.initialize()
      console.log('[Telegram] Storage initialized')

      // Load proxy config
      const proxyConfig = await loadProxyConfig()
      const proxyUrl = buildProxyUrl(proxyConfig)
      console.log('[Telegram] Proxy config:', proxyConfig.enabled ? proxyUrl : 'disabled')

      // Create bot options - disable auto polling, we'll do manual polling
      const options: TelegramBot.ConstructorOptions = {
        polling: false
      }

      // Add proxy if enabled
      if (proxyUrl) {
        const agent = new SocksProxyAgent(proxyUrl)
        // @ts-expect-error - node-telegram-bot-api accepts agent in request options
        options.request = { agent }
        console.log('[Telegram] Using proxy agent')
      }

      // Create bot instance
      console.log('[Telegram] Creating bot instance...')
      this.bot = new TelegramBot(botToken, options)

      // Setup event handlers
      this.setupEventHandlers()
      console.log('[Telegram] Event handlers set up')

      // Get bot info
      console.log('[Telegram] Getting bot info...')
      const me = await this.bot.getMe()
      this.status = {
        platform: 'telegram',
        isConnected: true,
        username: me.username
      }

      console.log(`[Telegram] Bot connected successfully: @${me.username}`)
      console.log(`[Telegram] Bot ID: ${me.id}`)

      // Start manual polling
      this.startManualPolling()
    } catch (error) {
      console.error('[Telegram] Connection error:', error)
      this.status = {
        platform: 'telegram',
        isConnected: false,
        error: error instanceof Error ? error.message : String(error)
      }
      throw error
    }
  }

  /**
   * Start manual polling loop
   */
  private startManualPolling(): void {
    this.pollingActive = true
    this.pollingCount = 0
    console.log('[Telegram] Starting manual polling loop...')
    this.pollOnce()
  }

  /**
   * Stop manual polling
   */
  private stopManualPolling(): void {
    this.pollingActive = false
    console.log('[Telegram] Polling stopped')
  }

  /**
   * Single polling iteration
   */
  private async pollOnce(): Promise<void> {
    if (!this.pollingActive || !this.bot) {
      return
    }

    this.pollingCount++
    const pollId = this.pollingCount

    try {
      const startTime = Date.now()

      // Get updates from Telegram
      const updates = await this.bot.getUpdates({
        offset: this.lastUpdateId + 1,
        timeout: 30,
        allowed_updates: ['message', 'edited_message', 'channel_post']
      })

      const duration = Date.now() - startTime

      // Process updates
      if (updates.length > 0) {
        for (const update of updates) {
          this.lastUpdateId = update.update_id

          if (update.message) {
            await this.processMessage(update.message)
          }
        }
      }
    } catch (error) {
      console.error(`[Telegram] Polling #${pollId} - ERROR:`, error)
      this.status.error = error instanceof Error ? error.message : String(error)
    }

    // Schedule next poll
    if (this.pollingActive) {
      setTimeout(() => this.pollOnce(), 1000)
    }
  }

  /**
   * Process a message from polling
   */
  private async processMessage(msg: TelegramMessage): Promise<void> {
    console.log('[Telegram] ========== MESSAGE RECEIVED ==========')
    console.log('[Telegram] Message ID:', msg.message_id)
    console.log('[Telegram] From:', msg.from?.first_name, `(@${msg.from?.username})`)
    console.log('[Telegram] Text:', msg.text)
    console.log('[Telegram] ======================================')

    try {
      await this.handleIncomingMessage(msg)
      console.log('[Telegram] Message stored successfully')
    } catch (error) {
      console.error('[Telegram] Error handling message:', error)
    }
  }

  /**
   * Disconnect from Telegram
   */
  async disconnect(): Promise<void> {
    this.stopManualPolling()
    if (this.bot) {
      this.bot = null
    }
    this.status = {
      platform: 'telegram',
      isConnected: false
    }
    console.log('[Telegram] Disconnected')
  }

  /**
   * Setup event handlers (for error handling)
   */
  private setupEventHandlers(): void {
    if (!this.bot) return

    // Handle general errors
    this.bot.on('error', (error) => {
      console.error('[Telegram] Bot error:', error.message)
    })

    console.log('[Telegram] Event handlers ready')
  }

  /**
   * Handle incoming message
   */
  private async handleIncomingMessage(msg: TelegramMessage): Promise<void> {
    console.log('[Telegram] Processing message...')

    // Skip if message is from a bot (avoid loops)
    if (msg.from?.is_bot) {
      console.log('[Telegram] Skipping bot message')
      return
    }

    // Store incoming message
    const storedMsg: StoredTelegramMessage = {
      messageId: msg.message_id,
      chatId: msg.chat.id,
      fromId: msg.from?.id,
      fromUsername: msg.from?.username,
      fromFirstName: msg.from?.first_name,
      text: msg.text,
      date: msg.date,
      replyToMessageId: msg.reply_to_message?.message_id,
      isFromBot: false
    }
    await telegramStorage.storeMessage(storedMsg)
    console.log('[Telegram] Message stored:', storedMsg.messageId)

    // Emit event for new message (to update UI)
    const appMessage = this.convertToAppMessage(storedMsg)
    appEvents.emitNewMessage(appMessage)

    // Process with Agent and reply (only if there's text)
    if (msg.text && this.bot) {
      await this.processWithAgentAndReply(msg.chat.id, msg.text)
    }
  }

  /**
   * Process message with Agent and send reply
   */
  private async processWithAgentAndReply(chatId: number, userMessage: string): Promise<void> {
    console.log('[Telegram] Sending to Agent:', userMessage)

    try {
      // Get response from Agent
      const response = await agentService.processMessage(userMessage)

      if (response.success && response.message) {
        console.log('[Telegram] Agent response:', response.message.substring(0, 100) + '...')

        // Send reply to Telegram
        const sentMsg = await this.bot!.sendMessage(chatId, response.message)
        console.log('[Telegram] Reply sent, message ID:', sentMsg.message_id)

        // Store bot's reply
        const botReply: StoredTelegramMessage = {
          messageId: sentMsg.message_id,
          chatId: chatId,
          fromId: sentMsg.from?.id,
          fromUsername: sentMsg.from?.username,
          fromFirstName: sentMsg.from?.first_name || 'Bot',
          text: response.message,
          date: sentMsg.date,
          isFromBot: true
        }
        await telegramStorage.storeMessage(botReply)

        // Emit event for bot's reply
        const appMessage = this.convertToAppMessage(botReply)
        appEvents.emitNewMessage(appMessage)
      } else {
        console.error('[Telegram] Agent error:', response.error)
        // Optionally send error message to user
        await this.bot!.sendMessage(chatId, `Error: ${response.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('[Telegram] Error processing with Agent:', error)
      await this.bot!.sendMessage(chatId, 'Sorry, something went wrong.')
    }
  }

  /**
   * Get bot status
   */
  getStatus(): BotStatus {
    return this.status
  }

  /**
   * Get all messages (loads from storage even if bot is not connected)
   */
  async getMessages(limit = 200): Promise<AppMessage[]> {
    const messages = await telegramStorage.getMessages(limit)
    return messages.map((msg) => this.convertToAppMessage(msg))
  }

  /**
   * Convert stored message to AppMessage
   */
  private convertToAppMessage(msg: StoredTelegramMessage): AppMessage {
    return {
      id: `${msg.chatId}-${msg.messageId}`,
      platform: 'telegram',
      chatId: msg.chatId.toString(),
      senderId: msg.fromId?.toString() || 'unknown',
      senderName: msg.fromFirstName || msg.fromUsername || 'Unknown',
      content: msg.text || '',
      timestamp: new Date(msg.date * 1000),
      isFromBot: msg.isFromBot,
      replyToId: msg.replyToMessageId?.toString()
    }
  }
}

// Export singleton instance
export const telegramBotService = new TelegramBotService()
