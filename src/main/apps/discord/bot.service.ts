// Use require for discord.js to avoid bundling issues
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Discord = require('discord.js')
const { Client, GatewayIntentBits, Events } = Discord as typeof import('discord.js')

// Import types from discord.js
type DiscordClient = import('discord.js').Client
type Message = import('discord.js').Message

import { discordStorage } from './storage'
import { loadProxyConfig } from '../../config/proxy.config'

/**
 * Set proxy environment variables for Discord.js (uses undici under the hood)
 */
async function setupProxyEnv(): Promise<void> {
  try {
    const config = await loadProxyConfig()
    if (config.enabled && config.host && config.port) {
      let proxyUrl: string
      if (config.type === 'socks5') {
        // Discord.js/undici doesn't natively support SOCKS5, but we can try
        // For SOCKS5, users may need to use a local HTTP proxy that tunnels to SOCKS5
        proxyUrl = `socks5://${config.host}:${config.port}`
        console.log('[Discord] Note: SOCKS5 proxy may not work directly with Discord.js')
        console.log('[Discord] Consider using an HTTP proxy or a SOCKS5-to-HTTP bridge')
      } else {
        proxyUrl = config.username
          ? `http://${config.username}:${config.password}@${config.host}:${config.port}`
          : `http://${config.host}:${config.port}`
      }
      // Set environment variables for undici/fetch
      process.env.HTTPS_PROXY = proxyUrl
      process.env.HTTP_PROXY = proxyUrl
      console.log(`[Discord] Proxy configured: ${config.type}://${config.host}:${config.port}`)
    }
  } catch (error) {
    console.log('[Discord] No proxy configured or error loading proxy config')
  }
}
import { getSetting } from '../../config/settings.config'
import { agentService } from '../../services/agent.service'
import { securityService } from '../../services/security.service'
import { appEvents } from '../../events'
import type { BotStatus, AppMessage, MessageAttachment } from '../types'
import type { StoredDiscordMessage, StoredAttachment } from './types'

/**
 * DiscordBotService manages the Discord bot connection and message handling
 * Single-user mode: only processes messages from bound users who @mention the bot
 */
export class DiscordBotService {
  private client: DiscordClient | null = null
  private status: BotStatus = {
    platform: 'discord',
    isConnected: false
  }
  private currentChannelId: string | null = null

  /**
   * Connect to Discord
   */
  async connect(): Promise<void> {
    try {
      console.log('[Discord] Starting connection...')

      // Setup proxy environment variables
      await setupProxyEnv()

      // Get bot token from settings
      const botToken = await getSetting('discordBotToken')
      if (!botToken) {
        throw new Error('Discord Bot Token not configured. Please set it in Settings.')
      }

      // Initialize storage
      await discordStorage.initialize()
      console.log('[Discord] Storage initialized')

      // Create client with required intents
      this.client = new Client({
        intents: [
          GatewayIntentBits.Guilds,
          GatewayIntentBits.GuildMessages,
          GatewayIntentBits.MessageContent,
          GatewayIntentBits.DirectMessages
        ]
      })

      // Setup ready promise BEFORE login to avoid missing the event
      const readyPromise = new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Connection timeout - Discord may be blocked. Check your network/proxy settings.'))
        }, 30000)

        this.client!.once(Events.ClientReady, () => {
          console.log('[Discord] ClientReady event received')
          clearTimeout(timeout)
          resolve()
        })

        this.client!.once(Events.Error, (error: Error) => {
          console.error('[Discord] Error event:', error)
          clearTimeout(timeout)
          reject(error)
        })
      })

      // Setup message handlers
      this.setupEventHandlers()
      console.log('[Discord] Event handlers set up')

      // Login (this triggers the connection)
      console.log('[Discord] Logging in...')
      await this.client.login(botToken)
      console.log('[Discord] Login successful, waiting for ready event...')

      // Wait for ready event
      await readyPromise

      // Get bot info
      const user = this.client.user
      if (user) {
        // Get bot avatar URL
        const avatarUrl = user.displayAvatarURL({ size: 128 })

        this.status = {
          platform: 'discord',
          isConnected: true,
          username: user.username,
          botName: user.displayName || user.username,
          avatarUrl
        }

        console.log(`[Discord] Bot connected: ${user.username}`)
        console.log(`[Discord] Bot ID: ${user.id}`)
        console.log(`[Discord] Bot avatar: ${avatarUrl}`)
      }

      appEvents.emitDiscordStatusChanged(this.status)

      // Update avatars for all bound users on startup
      this.updateBoundUsersAvatars().catch((err) => {
        console.error('[Discord] Error updating bound users avatars:', err)
      })
    } catch (error) {
      console.error('[Discord] Connection error:', error)
      this.status = {
        platform: 'discord',
        isConnected: false,
        error: error instanceof Error ? error.message : String(error)
      }
      appEvents.emitDiscordStatusChanged(this.status)
      throw error
    }
  }

  /**
   * Disconnect from Discord
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      this.client.destroy()
      this.client = null
    }
    this.status = {
      platform: 'discord',
      isConnected: false
    }
    appEvents.emitDiscordStatusChanged(this.status)
    console.log('[Discord] Disconnected')
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    if (!this.client) return

    this.client.on(Events.MessageCreate, async (message: Message) => {
      await this.handleMessage(message)
    })

    this.client.on(Events.Error, (error: Error) => {
      console.error('[Discord] Client error:', error)
      this.status.error = error.message
    })

    console.log('[Discord] Event handlers ready')
  }

  /**
   * Handle incoming message
   */
  private async handleMessage(message: Message): Promise<void> {
    // Ignore bot messages
    if (message.author.bot) return

    const userId = message.author.id
    const username = message.author.username

    console.log('[Discord] Message received from:', username, ':', message.content.substring(0, 50))

    try {
      // First check if bot is mentioned (required for all commands in Discord)
      const botMentioned = this.client?.user && message.mentions.has(this.client.user)
      if (!botMentioned) {
        // Silently ignore messages that don't mention the bot
        return
      }

      // Remove bot mention from content to get the actual command/message
      let content = message.content
      if (this.client?.user) {
        content = content.replace(new RegExp(`<@!?${this.client.user.id}>`, 'g'), '').trim()
      }

      console.log('[Discord] Content after removing mention:', content)

      // Check if this is a /bind command (doesn't require authorization)
      if (content.startsWith('/bind')) {
        await this.handleBindCommand(message, content)
        return
      }

      // For other messages, check if user is authorized
      const isAuthorized = await securityService.isAuthorizedByStringId(userId, 'discord')

      if (!isAuthorized) {
        console.log(`[Discord] Unauthorized user ${username}, ignoring message`)
        await message.reply(
          '❌ Your account is not bound to this device.\n\n' +
            'Use `@bot /bind <code>` to bind your account first.\n' +
            'Get the security code from the memU bot app (Settings → Security).'
        )
        return
      }

      // Process the message
      await this.handleIncomingMessage(message)
    } catch (error) {
      console.error('[Discord] Error handling message:', error)
    }
  }

  /**
   * Handle /bind command
   * @param message - The Discord message
   * @param content - The message content with bot mention removed
   */
  private async handleBindCommand(message: Message, content: string): Promise<void> {
    const userId = message.author.id
    const username = message.author.username
    const displayName = message.author.displayName || username
    // Get user avatar URL
    const avatarUrl = message.author.displayAvatarURL({ size: 128 })

    // Check if already bound on Discord platform
    const isAlreadyBound = await securityService.isAuthorizedByStringId(userId, 'discord')
    if (isAlreadyBound) {
      await message.reply('✅ Your account is already bound to this device.')
      return
    }

    // Extract security code from command (e.g., "/bind 123456")
    const parts = content.split(/\s+/)
    if (parts.length < 2 || !parts[1]) {
      await message.reply(
        '🔐 Please provide a security code:\n\n' +
          '`@bot /bind <6-digit-code>`\n\n' +
          'Get the code from the memU bot app (Settings → Security).'
      )
      return
    }

    const code = parts[1].trim()

    // Validate and bind to Discord platform using string ID
    // Discord snowflake IDs are too large for JavaScript numbers (precision loss)
    const result = await securityService.validateAndBindByStringId(
      code,
      userId, // Use original string ID directly
      username,
      displayName,
      undefined, // lastName
      'discord' // platform
    )

    if (result.success) {
      // Save user avatar after successful bind
      await securityService.updateUserAvatar(userId, 'discord', avatarUrl)
      console.log(`[Discord] User ${username} (${userId}) successfully bound with avatar: ${avatarUrl}`)
      await message.reply(
        `✅ Success! Your account **${username}** is now bound to this device.\n\n` +
          'You can now @mention the bot to interact with the AI assistant.'
      )
    } else {
      console.log(`[Discord] Bind failed for ${username}: ${result.error}`)
      await message.reply(`❌ ${result.error}`)
    }
  }

  /**
   * Handle incoming message from authorized user
   */
  private async handleIncomingMessage(message: Message): Promise<void> {
    console.log('[Discord] ========== Processing message ==========')
    console.log('[Discord] Message ID:', message.id)
    console.log('[Discord] Author:', message.author.username, `(${message.author.id})`)
    console.log('[Discord] Content (raw):', message.content)
    console.log('[Discord] Content length:', message.content.length)
    
    // Log attachments info
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const attachments = (message as any).attachments
    if (attachments && attachments.size > 0) {
      console.log('[Discord] Attachments count:', attachments.size)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      attachments.forEach((att: any, key: string) => {
        console.log('[Discord] Attachment:', {
          id: key,
          name: att.name,
          url: att.url,
          proxyURL: att.proxyURL,
          contentType: att.contentType,
          size: att.size,
          width: att.width,
          height: att.height
        })
      })
    } else {
      console.log('[Discord] Attachments: none')
    }

    // Log embeds info
    if (message.embeds && message.embeds.length > 0) {
      console.log('[Discord] Embeds count:', message.embeds.length)
      message.embeds.forEach((embed, idx) => {
        console.log(`[Discord] Embed ${idx}:`, {
          title: embed.title,
          description: embed.description?.substring(0, 100),
          url: embed.url,
          image: embed.image?.url,
          thumbnail: embed.thumbnail?.url
        })
      })
    } else {
      console.log('[Discord] Embeds: none')
    }

    // Set current channel for tool calls
    this.currentChannelId = message.channelId

    // Remove bot mention from content
    let content = message.content
    if (this.client?.user) {
      content = content.replace(new RegExp(`<@!?${this.client.user.id}>`, 'g'), '').trim()
    }
    console.log('[Discord] Content (cleaned):', content)

    // Extract attachments
    const storedAttachments: StoredAttachment[] = []
    if (attachments && attachments.size > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      attachments.forEach((att: any) => {
        storedAttachments.push({
          id: att.id,
          name: att.name,
          url: att.url,
          proxyURL: att.proxyURL,
          contentType: att.contentType,
          size: att.size,
          width: att.width,
          height: att.height
        })
      })
    }

    // Store incoming message
    const storedMsg: StoredDiscordMessage = {
      messageId: message.id,
      channelId: message.channelId,
      guildId: message.guildId || undefined,
      fromId: message.author.id,
      fromUsername: message.author.username,
      fromDisplayName: message.author.displayName,
      text: content,
      attachments: storedAttachments.length > 0 ? storedAttachments : undefined,
      date: Math.floor(message.createdTimestamp / 1000),
      isFromBot: false
    }
    await discordStorage.storeMessage(storedMsg)
    console.log('[Discord] Message stored:', storedMsg.messageId)

    // Emit event for new message
    const appMessage = this.convertToAppMessage(storedMsg)
    appEvents.emitDiscordNewMessage(appMessage)

    // Process with Agent and reply (if there's content or attachments)
    if (content || storedAttachments.length > 0) {
      console.log('[Discord] Sending to Agent, content:', content)
      console.log('[Discord] Attachments to send:', storedAttachments.length)
      await this.processWithAgentAndReply(message, content, storedAttachments)
    } else {
      console.log('[Discord] No text content or attachments, skipping Agent processing')
    }
    console.log('[Discord] ========== Message processing complete ==========')
  }

  /**
   * Process message with Agent and send reply
   */
  private async processWithAgentAndReply(
    originalMessage: Message,
    userMessage: string,
    attachments: StoredAttachment[] = []
  ): Promise<void> {
    console.log('[Discord] ===== Sending to Agent =====')
    console.log('[Discord] Full message being sent:', userMessage)
    console.log('[Discord] Message length:', userMessage.length)
    console.log('[Discord] Attachments count:', attachments.length)

    // Check if agent is already processing a message
    if (agentService.isProcessing()) {
      console.log('[Discord] Agent is busy, ignoring message')
      await originalMessage.reply('⏳ I\'m still processing the previous message. Please wait a moment and try again.')
      return
    }

    // Extract image URLs from attachments
    const imageUrls = attachments
      .filter(att => att.contentType?.startsWith('image/'))
      .map(att => att.url)
    
    console.log('[Discord] Image URLs:', imageUrls)

    // Build text message with attachment info
    let fullMessage = userMessage
    if (attachments.length > 0) {
      const attachmentDescriptions = attachments.map(att => {
        const type = att.contentType?.split('/')[0] || 'file'
        return `[Attachment: ${type} - ${att.name}]\nURL: ${att.url}`
      })
      const attachmentText = '\n\n--- Attachments ---\n' + attachmentDescriptions.join('\n\n')
      fullMessage = userMessage ? userMessage + attachmentText : attachmentText.trim()
    }

    console.log('[Discord] Full message with attachments:', fullMessage.substring(0, 200) + '...')

    try {
      // Get response from Agent with Discord-specific tools
      // Pass both text (with URLs) and image URLs for multimodal
      const response = await agentService.processMessage(fullMessage, 'discord', imageUrls)

      if (response.success && response.message) {
        console.log('[Discord] Agent response:', response.message.substring(0, 100) + '...')

        // Reply to the original message
        const sentMsg = await originalMessage.reply(response.message)
        console.log('[Discord] Reply sent, message ID:', sentMsg.id)

        // Store bot's reply
        const botReply: StoredDiscordMessage = {
          messageId: sentMsg.id,
          channelId: sentMsg.channelId,
          guildId: sentMsg.guildId || undefined,
          fromId: this.client?.user?.id || 'bot',
          fromUsername: this.client?.user?.username || 'Bot',
          fromDisplayName: this.client?.user?.displayName,
          text: response.message,
          date: Math.floor(sentMsg.createdTimestamp / 1000),
          replyToMessageId: originalMessage.id,
          isFromBot: true
        }
        await discordStorage.storeMessage(botReply)

        // Emit event for bot's reply
        const appMessage = this.convertToAppMessage(botReply)
        appEvents.emitDiscordNewMessage(appMessage)
      } else {
        console.error('[Discord] Agent error:', response.error)
        await originalMessage.reply(`Error: ${response.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('[Discord] Error processing with Agent:', error)
      await originalMessage.reply('Sorry, something went wrong.')
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
   * Get Discord client
   */
  getClient(): DiscordClient | null {
    return this.client
  }

  /**
   * Get all messages
   */
  async getMessages(limit = 200): Promise<AppMessage[]> {
    const messages = await discordStorage.getMessages(limit)
    return messages.map((msg) => this.convertToAppMessage(msg))
  }

  /**
   * Convert stored message to AppMessage
   */
  private convertToAppMessage(msg: StoredDiscordMessage): AppMessage {
    // Convert stored attachments to MessageAttachment format
    const attachments: MessageAttachment[] | undefined = msg.attachments?.map(att => ({
      id: att.id,
      name: att.name,
      url: att.url,
      contentType: att.contentType,
      size: att.size,
      width: att.width,
      height: att.height
    }))

    return {
      id: msg.messageId,
      platform: 'discord',
      chatId: msg.channelId,
      senderId: msg.fromId,
      senderName: msg.fromDisplayName || msg.fromUsername,
      content: msg.text || '',
      attachments,
      timestamp: new Date(msg.date * 1000),
      isFromBot: msg.isFromBot,
      replyToId: msg.replyToMessageId
    }
  }

  // ========== Public Media Sending Methods ==========

  /**
   * Send a text message to a channel
   */
  async sendText(
    channelId: string,
    text: string
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!this.client) {
      return { success: false, error: 'Bot not connected' }
    }
    try {
      const channel = await this.client.channels.fetch(channelId)
      if (!channel || !channel.isTextBased() || !('send' in channel)) {
        return { success: false, error: 'Invalid channel' }
      }
      // Type assertion since we've verified 'send' exists
      const msg = await (channel as { send: (text: string) => Promise<{ id: string }> }).send(text)
      return { success: true, messageId: msg.id }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  }

  /**
   * Send an embed message to a channel
   */
  async sendEmbed(
    channelId: string,
    embed: {
      title?: string
      description?: string
      color?: number
      url?: string
      footer?: string
      thumbnail_url?: string
      image_url?: string
      fields?: Array<{ name: string; value: string; inline?: boolean }>
    }
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!this.client) {
      return { success: false, error: 'Bot not connected' }
    }
    try {
      const channel = await this.client.channels.fetch(channelId)
      if (!channel || !channel.isTextBased() || !('send' in channel)) {
        return { success: false, error: 'Invalid channel' }
      }

      // Build embed object
      const embedData: Record<string, unknown> = {}
      if (embed.title) embedData.title = embed.title
      if (embed.description) embedData.description = embed.description
      if (embed.color) embedData.color = embed.color
      if (embed.url) embedData.url = embed.url
      if (embed.footer) embedData.footer = { text: embed.footer }
      if (embed.thumbnail_url) embedData.thumbnail = { url: embed.thumbnail_url }
      if (embed.image_url) embedData.image = { url: embed.image_url }
      if (embed.fields) embedData.fields = embed.fields

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const msg = await (channel as any).send({ embeds: [embedData] })
      return { success: true, messageId: msg.id }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  }

  /**
   * Send a file to a channel
   */
  async sendFile(
    channelId: string,
    filePath: string,
    options?: { filename?: string; description?: string }
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!this.client) {
      return { success: false, error: 'Bot not connected' }
    }
    try {
      const channel = await this.client.channels.fetch(channelId)
      if (!channel || !channel.isTextBased() || !('send' in channel)) {
        return { success: false, error: 'Invalid channel' }
      }

      const attachment = {
        attachment: filePath,
        name: options?.filename,
        description: options?.description
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const msg = await (channel as any).send({
        files: [attachment],
        content: options?.description
      })
      return { success: true, messageId: msg.id }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  }

  /**
   * Reply to a specific message
   */
  async reply(
    channelId: string,
    messageId: string,
    text: string
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!this.client) {
      return { success: false, error: 'Bot not connected' }
    }
    try {
      const channel = await this.client.channels.fetch(channelId)
      if (!channel || !channel.isTextBased() || !('messages' in channel)) {
        return { success: false, error: 'Invalid channel' }
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const message = await (channel as any).messages.fetch(messageId)
      const reply = await message.reply(text)
      return { success: true, messageId: reply.id }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  }

  /**
   * Add a reaction to a message
   */
  async addReaction(
    channelId: string,
    messageId: string,
    emoji: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.client) {
      return { success: false, error: 'Bot not connected' }
    }
    try {
      const channel = await this.client.channels.fetch(channelId)
      if (!channel || !channel.isTextBased() || !('messages' in channel)) {
        return { success: false, error: 'Invalid channel' }
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const message = await (channel as any).messages.fetch(messageId)
      await message.react(emoji)
      return { success: true }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  }

  /**
   * Send typing indicator
   */
  async sendTyping(
    channelId: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.client) {
      return { success: false, error: 'Bot not connected' }
    }
    try {
      const channel = await this.client.channels.fetch(channelId)
      if (!channel || !channel.isTextBased() || !('sendTyping' in channel)) {
        return { success: false, error: 'Invalid channel' }
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (channel as any).sendTyping()
      return { success: true }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  }

  /**
   * Update avatars for all bound Discord users
   * Called on startup to refresh avatar URLs
   */
  private async updateBoundUsersAvatars(): Promise<void> {
    if (!this.client) return

    const boundUsers = await securityService.getBoundUsers('discord')
    console.log(`[Discord] Updating avatars for ${boundUsers.length} bound users`)

    for (const user of boundUsers) {
      try {
        // Fetch user from Discord to get current avatar
        const discordUser = await this.client.users.fetch(user.uniqueId)
        if (discordUser) {
          const avatarUrl = discordUser.displayAvatarURL({ size: 128 })
          await securityService.updateUserAvatar(user.uniqueId, 'discord', avatarUrl)
          console.log(`[Discord] Updated avatar for ${user.username}: ${avatarUrl}`)
        }
      } catch (error) {
        console.error(`[Discord] Failed to update avatar for ${user.username}:`, error)
      }
    }
  }
}

// Export singleton instance
export const discordBotService = new DiscordBotService()
