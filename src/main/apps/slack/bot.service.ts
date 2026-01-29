import { App as SlackApp, LogLevel } from '@slack/bolt'
import { slackStorage } from './storage'
import { getSetting } from '../../config/settings.config'
import { agentService } from '../../services/agent.service'
import { securityService } from '../../services/security.service'
import { appEvents } from '../../events'
import type { BotStatus, AppMessage } from '../types'
import type { StoredSlackMessage, SlackWorkspace } from './types'
import * as fs from 'fs'

/**
 * SlackBotService manages Slack bot connection and message handling
 * Uses Slack Bolt SDK with Socket Mode for event handling
 */
export class SlackBotService {
  private app: SlackApp | null = null
  private status: BotStatus = {
    platform: 'slack',
    isConnected: false
  }
  private currentChannelId: string | null = null
  private currentThreadTs: string | null = null
  private workspace: SlackWorkspace | null = null
  private botUserId: string | null = null

  /**
   * Connect to Slack using Socket Mode
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

      if (!appToken) {
        throw new Error('Slack App Token not configured. Please set it in Settings for Socket Mode.')
      }

      // Initialize storage
      await slackStorage.initialize()
      console.log('[Slack] Storage initialized')

      // Create Slack app with Socket Mode
      this.app = new SlackApp({
        token: botToken,
        appToken: appToken,
        socketMode: true,
        logLevel: LogLevel.INFO
      })

      // Setup event handlers
      this.setupEventHandlers()

      // Start the app
      await this.app.start()
      console.log('[Slack] Socket Mode connection started')

      // Get bot info
      const authResult = await this.app.client.auth.test()
      this.botUserId = authResult.user_id as string
      console.log('[Slack] Bot User ID:', this.botUserId)

      // Try to get workspace info (optional, requires team:read scope)
      if (authResult.team_id) {
        try {
          const teamInfo = await this.app.client.team.info({ team: authResult.team_id as string })
          if (teamInfo.team) {
            this.workspace = {
              id: teamInfo.team.id || '',
              name: teamInfo.team.name || '',
              domain: teamInfo.team.domain || ''
            }
            console.log('[Slack] Workspace:', this.workspace.name)
          }
        } catch (teamError) {
          // team:read scope might not be available, use basic info from auth.test
          console.log('[Slack] Could not get workspace info (team:read scope may be missing), using basic info')
          this.workspace = {
            id: authResult.team_id as string,
            name: authResult.team as string || 'Unknown',
            domain: ''
          }
        }
      }

      // Update status
      this.status = {
        platform: 'slack',
        isConnected: true,
        username: authResult.user as string,
        botName: authResult.bot_id as string
      }

      appEvents.emitSlackStatusChanged(this.status)
      console.log('[Slack] Connected successfully')

      // Update avatars for all bound users on startup
      this.updateBoundUsersAvatars().catch((err) => {
        console.error('[Slack] Error updating bound users avatars:', err)
      })
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
   * Setup event handlers for Slack events
   */
  private setupEventHandlers(): void {
    if (!this.app) return

    // Handle /bind slash command
    this.app.command('/bind', async ({ command, ack, respond }) => {
      // Acknowledge the command immediately
      await ack()

      const userId = command.user_id
      const username = command.user_name
      const code = command.text.trim()

      console.log(`[Slack] /bind command from ${username} (${userId}) with code: ${code}`)

      if (!code) {
        await respond({
          response_type: 'ephemeral',
          text: '❌ Please provide a security code. Usage: `/bind <code>`'
        })
        return
      }

      // Validate code and bind user
      const bindResult = await securityService.validateAndBindByStringId(
        code,
        userId,
        username,
        undefined,
        undefined,
        'slack'
      )

      if (bindResult.success) {
        // Try to get user avatar after successful bind
        const avatarUrl = await this.getUserAvatarUrl(userId)
        if (avatarUrl) {
          await securityService.updateUserAvatar(userId, 'slack', avatarUrl)
          console.log(`[Slack] User ${username} (${userId}) bound with avatar: ${avatarUrl}`)
        } else {
          console.log(`[Slack] User ${username} (${userId}) bound successfully (no avatar)`)
        }

        await respond({
          response_type: 'ephemeral',
          text: `✅ Successfully bound! Welcome, ${username}. You can now chat with me.`
        })
      } else {
        await respond({
          response_type: 'ephemeral',
          text: `❌ ${bindResult.error}`
        })
      }
    })

    // Handle mentions in channels - requires @mention
    this.app.event('app_mention', async ({ event, say }) => {
      console.log('[Slack] Received app_mention event:', event)
      await this.handleMessage(event, say, false)
    })

    // Handle direct messages - no @mention required
    this.app.event('message', async ({ event, say }) => {
      // Type guard for message events
      if (!('user' in event) || !event.user) return
      if ('bot_id' in event && event.bot_id) return // Ignore bot messages
      if ('subtype' in event && event.subtype) return // Ignore message subtypes (edits, deletes, etc.)

      // Check if it's a DM (channel_type: 'im')
      // DM channels start with 'D', but the safest way is to check channel_type
      const channelType = 'channel_type' in event ? (event as { channel_type?: string }).channel_type : undefined
      
      // Only handle DMs in this event handler
      // Channel messages should go through app_mention
      if (channelType !== 'im') {
        console.log('[Slack] Message is not a DM, ignoring (use @mention in channels)')
        return
      }

      console.log('[Slack] Received DM message event:', event)
      await this.handleMessage(event, say, true)
    })
  }

  /**
   * Handle incoming message
   * @param event - Slack message event
   * @param say - Function to send a reply
   * @param isDM - Whether this is a direct message (no @mention required)
   */
  private async handleMessage(
    event: {
      user?: string
      text?: string
      channel: string
      ts: string
      thread_ts?: string
    },
    say: (message: string | { text: string; thread_ts?: string }) => Promise<unknown>,
    isDM: boolean = false
  ): Promise<void> {
    const userId = event.user
    const text = event.text || ''
    const channelId = event.channel
    const messageTs = event.ts
    const threadTs = event.thread_ts

    if (!userId) {
      console.log('[Slack] Message has no user ID, ignoring')
      return
    }

    console.log('[Slack] Processing message from user:', userId)
    console.log('[Slack] Message text:', text)

    // Set current context
    this.currentChannelId = channelId
    this.currentThreadTs = threadTs || messageTs

    // Get user info
    let username = userId
    let displayName: string | undefined

    try {
      if (this.app) {
        const userInfo = await this.app.client.users.info({ user: userId })
        if (userInfo.user) {
          username = userInfo.user.name || userId
          displayName = userInfo.user.real_name || userInfo.user.profile?.display_name
        }
      }
    } catch (error) {
      console.error('[Slack] Failed to get user info:', error)
    }

    // Remove bot mention from text if present (only for channel messages, not DMs)
    let cleanText = text
    if (!isDM && this.botUserId) {
      cleanText = text.replace(new RegExp(`<@${this.botUserId}>`, 'g'), '').trim()
    }

    // Check for /bind command
    if (cleanText.startsWith('/bind ') || cleanText === '/bind') {
      await this.handleBindCommand(userId, username, cleanText, say)
      return
    }

    // Check if user is authorized
    const isAuthorized = await securityService.isAuthorizedByStringId(userId, 'slack')
    if (!isAuthorized) {
      console.log(`[Slack] Unauthorized user ${username}, ignoring message`)
      // In DMs: reply directly, in channels: reply in thread
      const unauthorizedReplyThreadTs = isDM ? threadTs : (threadTs || messageTs)
      const unauthorizedMsg = '⚠️ You are not authorized to use this bot. Please use `/bind <code>` to bind your account first.'
      await say(unauthorizedReplyThreadTs ? { text: unauthorizedMsg, thread_ts: unauthorizedReplyThreadTs } : unauthorizedMsg)
      return
    }

    // Store incoming message
    const storedMsg: StoredSlackMessage = {
      messageId: messageTs,
      channelId,
      threadTs,
      fromId: userId,
      fromUsername: username,
      fromDisplayName: displayName,
      text: cleanText,
      date: Math.floor(parseFloat(messageTs)),
      isFromBot: false
    }
    await slackStorage.storeMessage(storedMsg)
    console.log('[Slack] Message stored:', storedMsg.messageId)

    // Emit event for new message
    const appMessage = this.convertToAppMessage(storedMsg)
    appEvents.emitSlackNewMessage(appMessage)

    // Process with Agent and reply
    if (cleanText) {
      // In DMs: only use thread if user is already in one, otherwise reply directly
      // In channels: always reply in thread
      const replyThreadTs = isDM ? threadTs : (threadTs || messageTs)
      await this.processWithAgentAndReply(channelId, cleanText, replyThreadTs, say)
    }
  }

  /**
   * Handle /bind command
   */
  private async handleBindCommand(
    userId: string,
    username: string,
    text: string,
    say: (message: string | { text: string; thread_ts?: string }) => Promise<unknown>
  ): Promise<void> {
    const parts = text.split(' ')
    const code = parts[1]

    if (!code) {
      await say('❌ Please provide a security code. Usage: `/bind <code>` or `@bot /bind <code>`')
      return
    }

    console.log(`[Slack] Bind attempt from ${username} (${userId}) with code: ${code}`)

    // Validate code and bind user in one step
    const bindResult = await securityService.validateAndBindByStringId(
      code,
      userId,
      username,
      undefined, // firstName
      undefined, // lastName
      'slack'
    )

    if (bindResult.success) {
      // Try to get user avatar after successful bind
      const avatarUrl = await this.getUserAvatarUrl(userId)
      if (avatarUrl) {
        await securityService.updateUserAvatar(userId, 'slack', avatarUrl)
        console.log(`[Slack] User ${username} (${userId}) bound with avatar: ${avatarUrl}`)
      } else {
        console.log(`[Slack] User ${username} (${userId}) bound successfully (no avatar)`)
      }

      await say(`✅ Successfully bound! Welcome, ${username}. You can now chat with me.`)
    } else {
      await say(`❌ ${bindResult.error}`)
    }
  }

  /**
   * Process message with Agent and send reply
   * @param threadTs - Thread timestamp for reply. If undefined, replies directly without threading (for DMs)
   */
  private async processWithAgentAndReply(
    channelId: string,
    userMessage: string,
    threadTs: string | undefined,
    say: (message: string | { text: string; thread_ts?: string }) => Promise<unknown>
  ): Promise<void> {
    console.log('[Slack] Sending to Agent:', userMessage.substring(0, 50) + '...')

    if (agentService.isProcessing()) {
      console.log('[Slack] Agent is busy, ignoring message')
      // Reply with or without thread based on threadTs
      await say(threadTs ? { text: '⏳ Please wait, I\'m still processing the previous message...', thread_ts: threadTs } : '⏳ Please wait, I\'m still processing the previous message...')
      return
    }

    try {
      const response = await agentService.processMessage(userMessage, 'slack')

      if (response.success && response.message) {
        console.log('[Slack] Agent response:', response.message.substring(0, 100) + '...')

        // Send reply (in thread if threadTs is provided, otherwise direct reply for DMs)
        await say(threadTs ? { text: response.message, thread_ts: threadTs } : response.message)

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
      await say(threadTs ? { text: '❌ Sorry, an error occurred while processing your message.', thread_ts: threadTs } : '❌ Sorry, an error occurred while processing your message.')
    }
  }

  /**
   * Disconnect from Slack
   */
  async disconnect(): Promise<void> {
    try {
      if (this.app) {
        await this.app.stop()
        this.app = null
      }
    } catch (error) {
      console.error('[Slack] Error stopping app:', error)
    }

    this.status = {
      platform: 'slack',
      isConnected: false
    }
    this.workspace = null
    this.botUserId = null
    this.currentChannelId = null
    this.currentThreadTs = null

    appEvents.emitSlackStatusChanged(this.status)
    console.log('[Slack] Disconnected')
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
   * Get current thread timestamp
   */
  getCurrentThreadTs(): string | null {
    return this.currentThreadTs
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
    // Convert stored attachments to MessageAttachment format
    const attachments = msg.attachments?.map(att => ({
      id: att.id,
      name: att.name,
      url: att.url,
      contentType: att.mimetype,
      size: att.size || 0
    }))

    return {
      id: msg.messageId,
      platform: 'slack',
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

  // ========== Public Messaging Methods ==========

  /**
   * Send a text message
   */
  async sendText(
    channelId: string,
    text: string,
    threadTs?: string
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!this.status.isConnected || !this.app) {
      return { success: false, error: 'Bot not connected' }
    }

    try {
      const result = await this.app.client.chat.postMessage({
        channel: channelId,
        text,
        thread_ts: threadTs
      })

      if (result.ok && result.ts) {
        // Store bot's message
        const botMsg: StoredSlackMessage = {
          messageId: result.ts,
          channelId,
          threadTs,
          fromId: 'bot',
          fromUsername: 'Bot',
          text,
          date: Math.floor(Date.now() / 1000),
          isFromBot: true
        }
        await slackStorage.storeMessage(botMsg)
        appEvents.emitSlackNewMessage(this.convertToAppMessage(botMsg))

        return { success: true, messageId: result.ts }
      }

      return { success: false, error: 'Failed to send message' }
    } catch (error) {
      console.error('[Slack] Error sending text:', error)
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
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
    if (!this.status.isConnected || !this.app) {
      return { success: false, error: 'Bot not connected' }
    }

    try {
      // Use any type to avoid Block Kit type complexity
      const result = await this.app.client.chat.postMessage({
        channel: channelId,
        blocks: blocks as any,
        text: text || 'Message with blocks',
        thread_ts: threadTs
      })

      if (result.ok && result.ts) {
        return { success: true, messageId: result.ts }
      }

      return { success: false, error: 'Failed to send blocks' }
    } catch (error) {
      console.error('[Slack] Error sending blocks:', error)
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
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
    if (!this.status.isConnected || !this.app) {
      return { success: false, error: 'Bot not connected' }
    }

    try {
      const fileContent = fs.readFileSync(filePath)

      const result = await this.app.client.files.uploadV2({
        channel_id: channelId,
        file: fileContent,
        filename: filename || filePath.split('/').pop(),
        title,
        initial_comment: initialComment
      }) as any

      if (result.ok && result.files && result.files[0]) {
        return { success: true, fileId: result.files[0].id }
      }

      return { success: false, error: 'Failed to upload file' }
    } catch (error) {
      console.error('[Slack] Error uploading file:', error)
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  }

  /**
   * Add a reaction to a message
   */
  async addReaction(
    channelId: string,
    messageTs: string,
    emoji: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.status.isConnected || !this.app) {
      return { success: false, error: 'Bot not connected' }
    }

    try {
      const result = await this.app.client.reactions.add({
        channel: channelId,
        timestamp: messageTs,
        name: emoji
      })

      if (result.ok) {
        return { success: true }
      }

      return { success: false, error: 'Failed to add reaction' }
    } catch (error) {
      console.error('[Slack] Error adding reaction:', error)
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  }

  /**
   * Send ephemeral message (visible only to specific user)
   */
  async sendEphemeral(
    channelId: string,
    userId: string,
    text: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.status.isConnected || !this.app) {
      return { success: false, error: 'Bot not connected' }
    }

    try {
      const result = await this.app.client.chat.postEphemeral({
        channel: channelId,
        user: userId,
        text
      })

      if (result.ok) {
        return { success: true }
      }

      return { success: false, error: 'Failed to send ephemeral message' }
    } catch (error) {
      console.error('[Slack] Error sending ephemeral:', error)
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  }

  /**
   * Get user avatar URL from Slack
   */
  private async getUserAvatarUrl(userId: string): Promise<string | undefined> {
    if (!this.app) return undefined

    try {
      const userInfo = await this.app.client.users.info({ user: userId })
      if (userInfo.user?.profile) {
        // Prefer larger images, fall back to smaller ones
        return (
          userInfo.user.profile.image_192 ||
          userInfo.user.profile.image_72 ||
          userInfo.user.profile.image_48 ||
          userInfo.user.profile.image_32 ||
          userInfo.user.profile.image_24
        )
      }
    } catch (error) {
      console.log(`[Slack] Could not get avatar for user ${userId}:`, error)
    }
    return undefined
  }

  /**
   * Update avatars for all bound Slack users
   * Called on startup to refresh avatar URLs
   */
  private async updateBoundUsersAvatars(): Promise<void> {
    if (!this.app) return

    const boundUsers = await securityService.getBoundUsers('slack')
    console.log(`[Slack] Updating avatars for ${boundUsers.length} bound users`)

    for (const user of boundUsers) {
      try {
        const avatarUrl = await this.getUserAvatarUrl(user.uniqueId)
        if (avatarUrl) {
          await securityService.updateUserAvatar(user.uniqueId, 'slack', avatarUrl)
          console.log(`[Slack] Updated avatar for ${user.username}: ${avatarUrl}`)
        }
      } catch (error) {
        console.error(`[Slack] Failed to update avatar for ${user.username}:`, error)
      }
    }
  }
}

// Export singleton instance
export const slackBotService = new SlackBotService()
