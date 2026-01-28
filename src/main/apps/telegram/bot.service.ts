import TelegramBot from 'node-telegram-bot-api'
import { SocksProxyAgent } from 'socks-proxy-agent'
import { telegramStorage } from './storage'
import { loadProxyConfig, buildProxyUrl } from '../../config/proxy.config'
import { getSetting } from '../../config/settings.config'
import { agentService } from '../../services/agent.service'
import { securityService } from '../../services/security.service'
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
  private currentChatId: number | null = null // Track current chat for tool calls

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

      // Get bot avatar
      let avatarUrl: string | undefined
      try {
        const photos = await this.bot.getUserProfilePhotos(me.id, { limit: 1 })
        if (photos.total_count > 0 && photos.photos[0]?.length > 0) {
          // Get the smallest photo (last in array) for efficiency
          const photo = photos.photos[0][photos.photos[0].length - 1]
          avatarUrl = await this.bot.getFileLink(photo.file_id)
        }
      } catch (photoError) {
        console.log('[Telegram] Could not get bot avatar:', photoError)
      }

      this.status = {
        platform: 'telegram',
        isConnected: true,
        username: me.username,
        botName: me.first_name,
        avatarUrl
      }

      console.log(`[Telegram] Bot connected successfully: @${me.username}`)
      console.log(`[Telegram] Bot name: ${me.first_name}`)
      console.log(`[Telegram] Bot ID: ${me.id}`)
      console.log(`[Telegram] Bot avatar: ${avatarUrl || 'none'}`)

      // Emit status changed event
      appEvents.emitTelegramStatusChanged(this.status)

      // Start manual polling
      this.startManualPolling()
    } catch (error) {
      console.error('[Telegram] Connection error:', error)
      this.status = {
        platform: 'telegram',
        isConnected: false,
        error: error instanceof Error ? error.message : String(error)
      }
      appEvents.emitTelegramStatusChanged(this.status)
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
    console.log('[Telegram] User ID:', msg.from?.id)
    console.log('[Telegram] Text:', msg.text)
    console.log('[Telegram] ======================================')

    try {
      // Check if this is a /bind command
      if (msg.text?.startsWith('/bind')) {
        await this.handleBindCommand(msg)
        return
      }

      // Check if user is authorized
      const userId = msg.from?.id
      if (!userId) {
        console.log('[Telegram] No user ID, ignoring message')
        return
      }

      const isAuthorized = await securityService.isAuthorized(userId, 'telegram')
      if (!isAuthorized) {
        console.log(`[Telegram] Unauthorized user ${userId}, sending error message`)
        await this.sendUnauthorizedMessage(msg.chat.id)
        return
      }

      await this.handleIncomingMessage(msg)
      console.log('[Telegram] Message processed successfully')
    } catch (error) {
      console.error('[Telegram] Error handling message:', error)
    }
  }

  /**
   * Handle /bind command
   */
  private async handleBindCommand(msg: TelegramMessage): Promise<void> {
    const userId = msg.from?.id
    const username = msg.from?.username || 'unknown'
    const firstName = msg.from?.first_name
    const lastName = msg.from?.last_name
    const chatId = msg.chat.id

    if (!userId) {
      await this.bot?.sendMessage(chatId, '❌ Unable to identify your account.')
      return
    }

    // Check if already bound on Telegram platform
    const isAlreadyBound = await securityService.isAuthorized(userId, 'telegram')
    if (isAlreadyBound) {
      await this.bot?.sendMessage(chatId, '✅ Your account is already bound to this device.')
      return
    }

    // Extract security code from command
    const parts = msg.text?.split(' ')
    if (!parts || parts.length < 2) {
      await this.bot?.sendMessage(
        chatId,
        '🔐 Please provide a security code:\n\n' +
          '`/bind <6-digit-code>`\n\n' +
          'Get the code from the Local Memu app (Settings → Security).',
        { parse_mode: 'Markdown' }
      )
      return
    }

    const code = parts[1].trim()

    // Validate and bind to Telegram platform
    const result = await securityService.validateAndBind(
      code,
      userId,
      username,
      firstName,
      lastName,
      'telegram'
    )

    if (result.success) {
      console.log(`[Telegram] User ${username} (${userId}) successfully bound`)
      await this.bot?.sendMessage(
        chatId,
        `✅ Success! Your account @${username} is now bound to this device.\n\n` +
          'You can now send messages to interact with the AI assistant.'
      )
    } else {
      console.log(`[Telegram] Bind failed for ${username}: ${result.error}`)
      await this.bot?.sendMessage(chatId, `❌ ${result.error}`)
    }
  }

  /**
   * Send unauthorized message
   */
  private async sendUnauthorizedMessage(chatId: number): Promise<void> {
    await this.bot?.sendMessage(
      chatId,
      '🔒 This bot is private.\n\n' +
        'To use this bot, you need to bind your account first.\n' +
        'Use `/bind <security-code>` with a code from the Local Memu app.',
      { parse_mode: 'Markdown' }
    )
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
    appEvents.emitTelegramStatusChanged(this.status)
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

    // Check if agent is already processing a message
    if (agentService.isProcessing()) {
      console.log('[Telegram] Agent is busy, ignoring message')
      await this.bot?.sendMessage(chatId, '⏳ I\'m still processing the previous message. Please wait a moment and try again.')
      return
    }

    // Set current chat ID for tool calls
    this.currentChatId = chatId

    try {
      // Get response from Agent with Telegram-specific tools
      const response = await agentService.processMessage(userMessage, 'telegram')

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

  /**
   * Get current active chat ID
   */
  getCurrentChatId(): number | null {
    return this.currentChatId
  }

  /**
   * Get bot instance for direct operations
   */
  getBot(): TelegramBot | null {
    return this.bot
  }

  // ========== Public Media Sending Methods ==========

  /**
   * Send a text message
   */
  async sendText(
    chatId: number,
    text: string,
    options?: { parse_mode?: 'Markdown' | 'HTML'; reply_to_message_id?: number }
  ): Promise<{ success: boolean; messageId?: number; error?: string }> {
    if (!this.bot) {
      return { success: false, error: 'Bot not connected' }
    }
    try {
      const msg = await this.bot.sendMessage(chatId, text, options)
      return { success: true, messageId: msg.message_id }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  }

  /**
   * Send a photo
   */
  async sendPhoto(
    chatId: number,
    photo: string | Buffer,
    options?: { caption?: string; parse_mode?: 'Markdown' | 'HTML'; filename?: string }
  ): Promise<{ success: boolean; messageId?: number; error?: string }> {
    if (!this.bot) {
      return { success: false, error: 'Bot not connected' }
    }
    try {
      const sendOptions: TelegramBot.SendPhotoOptions = {}
      if (options?.caption) sendOptions.caption = options.caption
      if (options?.parse_mode) sendOptions.parse_mode = options.parse_mode
      const fileOptions: TelegramBot.FileOptions = {}
      if (options?.filename) fileOptions.filename = options.filename
      const msg = await this.bot.sendPhoto(chatId, photo, sendOptions, fileOptions)
      return { success: true, messageId: msg.message_id }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  }

  /**
   * Send a document/file
   */
  async sendDocument(
    chatId: number,
    document: string | Buffer,
    options?: { caption?: string; filename?: string }
  ): Promise<{ success: boolean; messageId?: number; error?: string }> {
    if (!this.bot) {
      return { success: false, error: 'Bot not connected' }
    }
    try {
      const sendOptions: TelegramBot.SendDocumentOptions = {}
      if (options?.caption) sendOptions.caption = options.caption
      const fileOptions: TelegramBot.FileOptions = {}
      if (options?.filename) fileOptions.filename = options.filename
      const msg = await this.bot.sendDocument(chatId, document, sendOptions, fileOptions)
      return { success: true, messageId: msg.message_id }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  }

  /**
   * Send a video
   */
  async sendVideo(
    chatId: number,
    video: string | Buffer,
    options?: { caption?: string; duration?: number; width?: number; height?: number; filename?: string }
  ): Promise<{ success: boolean; messageId?: number; error?: string }> {
    if (!this.bot) {
      return { success: false, error: 'Bot not connected' }
    }
    try {
      const sendOptions: TelegramBot.SendVideoOptions = {}
      if (options?.caption) sendOptions.caption = options.caption
      if (options?.duration) sendOptions.duration = options.duration
      if (options?.width) sendOptions.width = options.width
      if (options?.height) sendOptions.height = options.height
      const fileOptions: TelegramBot.FileOptions = {}
      if (options?.filename) fileOptions.filename = options.filename
      const msg = await this.bot.sendVideo(chatId, video, sendOptions, fileOptions)
      return { success: true, messageId: msg.message_id }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  }

  /**
   * Send an audio file
   */
  async sendAudio(
    chatId: number,
    audio: string | Buffer,
    options?: { caption?: string; duration?: number; performer?: string; title?: string; filename?: string }
  ): Promise<{ success: boolean; messageId?: number; error?: string }> {
    if (!this.bot) {
      return { success: false, error: 'Bot not connected' }
    }
    try {
      const sendOptions: TelegramBot.SendAudioOptions = {}
      if (options?.caption) sendOptions.caption = options.caption
      if (options?.duration) sendOptions.duration = options.duration
      if (options?.performer) sendOptions.performer = options.performer
      if (options?.title) sendOptions.title = options.title
      const fileOptions: TelegramBot.FileOptions = {}
      if (options?.filename) fileOptions.filename = options.filename
      const msg = await this.bot.sendAudio(chatId, audio, sendOptions, fileOptions)
      return { success: true, messageId: msg.message_id }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  }

  /**
   * Send a voice message
   */
  async sendVoice(
    chatId: number,
    voice: string | Buffer,
    options?: { caption?: string; duration?: number; filename?: string }
  ): Promise<{ success: boolean; messageId?: number; error?: string }> {
    if (!this.bot) {
      return { success: false, error: 'Bot not connected' }
    }
    try {
      const sendOptions: TelegramBot.SendVoiceOptions = {}
      if (options?.caption) sendOptions.caption = options.caption
      if (options?.duration) sendOptions.duration = options.duration
      const fileOptions: TelegramBot.FileOptions = {}
      if (options?.filename) fileOptions.filename = options.filename
      const msg = await this.bot.sendVoice(chatId, voice, sendOptions, fileOptions)
      return { success: true, messageId: msg.message_id }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  }

  /**
   * Send a sticker
   */
  async sendSticker(
    chatId: number,
    sticker: string | Buffer,
    options?: { filename?: string }
  ): Promise<{ success: boolean; messageId?: number; error?: string }> {
    if (!this.bot) {
      return { success: false, error: 'Bot not connected' }
    }
    try {
      const sendOptions: TelegramBot.SendStickerOptions = {}
      const fileOptions: TelegramBot.FileOptions = {}
      if (options?.filename) fileOptions.filename = options.filename
      const msg = await this.bot.sendSticker(chatId, sticker, sendOptions, fileOptions)
      return { success: true, messageId: msg.message_id }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  }

  /**
   * Send a location
   */
  async sendLocation(
    chatId: number,
    latitude: number,
    longitude: number
  ): Promise<{ success: boolean; messageId?: number; error?: string }> {
    if (!this.bot) {
      return { success: false, error: 'Bot not connected' }
    }
    try {
      const msg = await this.bot.sendLocation(chatId, latitude, longitude)
      return { success: true, messageId: msg.message_id }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  }

  /**
   * Send a contact
   */
  async sendContact(
    chatId: number,
    phoneNumber: string,
    firstName: string,
    options?: { last_name?: string }
  ): Promise<{ success: boolean; messageId?: number; error?: string }> {
    if (!this.bot) {
      return { success: false, error: 'Bot not connected' }
    }
    try {
      const msg = await this.bot.sendContact(chatId, phoneNumber, firstName, options)
      return { success: true, messageId: msg.message_id }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  }

  /**
   * Send a poll
   */
  async sendPoll(
    chatId: number,
    question: string,
    pollOptions: string[],
    options?: { is_anonymous?: boolean; allows_multiple_answers?: boolean }
  ): Promise<{ success: boolean; messageId?: number; error?: string }> {
    if (!this.bot) {
      return { success: false, error: 'Bot not connected' }
    }
    try {
      const msg = await this.bot.sendPoll(chatId, question, pollOptions, options)
      return { success: true, messageId: msg.message_id }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  }

  /**
   * Send chat action (typing, uploading, etc.)
   */
  async sendChatAction(
    chatId: number,
    action: 'typing' | 'upload_photo' | 'upload_video' | 'upload_voice' | 'upload_document' | 'find_location' | 'record_video' | 'record_voice' | 'record_video_note' | 'upload_video_note'
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.bot) {
      return { success: false, error: 'Bot not connected' }
    }
    try {
      await this.bot.sendChatAction(chatId, action)
      return { success: true }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  }
}

// Export singleton instance
export const telegramBotService = new TelegramBotService()
