import TelegramBot from 'node-telegram-bot-api'
import { telegramStorage } from './storage'
import { app } from 'electron'
import * as fs from 'fs/promises'
import * as path from 'path'

// Disable node-telegram-bot-api deprecation warning about content-type
// We explicitly set contentType in all file sending methods
process.env.NTBA_FIX_350 = '1'
import { getSetting } from '../../config/settings.config'
import { agentService } from '../../services/agent.service'
import { infraService } from '../../services/infra.service'
import { securityService } from '../../services/security.service'
import { trackUserMessage } from '../../services/analytics.service'
import { appEvents } from '../../events'
import type { BotStatus, AppMessage } from '../types'
import type { StoredTelegramMessage, StoredTelegramAttachment, TelegramMessage } from './types'

/**
 * Convert Markdown to Telegram HTML format
 * HTML mode is more stable than Markdown mode - it won't misparse @username, #hashtag, etc.
 * Only need to escape: < > &
 */
function markdownToTelegramHtml(text: string): string {
  // First, escape HTML special characters (but preserve what we'll convert)
  let result = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  // Handle code blocks first (```...```) - preserve content as-is
  result = result.replace(/```(\w*)\n?([\s\S]*?)```/g, (_match, _lang, code) => {
    return `<pre>${code.trim()}</pre>`
  })

  // Handle inline code (`...`)
  result = result.replace(/`([^`]+)`/g, '<code>$1</code>')

  // Handle bold+italic (***...*** or ___...___) - must be before bold and italic
  result = result.replace(/\*\*\*([^*]+)\*\*\*/g, '<b><i>$1</i></b>')
  result = result.replace(/___([^_]+)___/g, '<b><i>$1</i></b>')

  // Handle bold (**...** or __...__)
  result = result.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
  result = result.replace(/__([^_]+)__/g, '<b>$1</b>')

  // Handle italic (*...* or _..._) - be careful not to match inside words
  // Only match if surrounded by spaces/punctuation or at start/end
  result = result.replace(/(?<![a-zA-Z0-9])\*([^*]+)\*(?![a-zA-Z0-9])/g, '<i>$1</i>')
  result = result.replace(/(?<![a-zA-Z0-9])_([^_]+)_(?![a-zA-Z0-9])/g, '<i>$1</i>')

  // Handle strikethrough (~~...~~)
  result = result.replace(/~~([^~]+)~~/g, '<s>$1</s>')

  // Handle links [text](url)
  result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')

  // Handle horizontal rules (---, ***, ___) - convert to a visual separator
  result = result.replace(/^([-*_]){3,}\s*$/gm, '─────────────────')

  // Handle headings (# ## ### etc.) - convert to bold text
  // Note: Telegram doesn't support heading sizes, so we just make them bold
  result = result.replace(/^#{1,6}\s+(.+)$/gm, '<b>$1</b>')

  // Handle blockquotes (> text) - note: > is already escaped to &gt;
  result = result.replace(/^&gt;\s*(.*)$/gm, '┃ <i>$1</i>')

  // Handle task lists - [x] becomes ✅, [ ] becomes ⬜
  result = result.replace(/^(\s*[-*])\s*\[x\]\s*/gim, '$1 ✅ ')
  result = result.replace(/^(\s*[-*])\s*\[\s*\]\s*/gm, '$1 ⬜ ')

  // Handle Markdown tables - convert to a readable text format
  // Telegram doesn't support tables, so we format them nicely with monospace
  result = result.replace(/^\|(.+)\|$/gm, (_match, content) => {
    // Check if this is a separator row (|---|---|)
    if (/^[\s\-:|]+$/.test(content)) {
      return '─────────────────'
    }
    // Format table row: | col1 | col2 | -> col1 │ col2
    const cells = content.split('|').map((cell: string) => cell.trim())
    return cells.join(' │ ')
  })

  return result
}

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

      // Create bot options - disable auto polling, we'll do manual polling
      const options: TelegramBot.ConstructorOptions = {
        polling: false
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

      // Update avatars for all bound users on startup
      this.updateBoundUsersAvatars().catch((err) => {
        console.error('[Telegram] Error updating bound users avatars:', err)
      })

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
    const firstName = msg.from?.first_name
    const lastName = msg.from?.last_name
    const chatId = msg.chat.id

    // Use username if available, otherwise use firstName (+ lastName)
    const telegramUsername = msg.from?.username
    const displayName = firstName
      ? lastName
        ? `${firstName} ${lastName}`
        : firstName
      : 'User'
    // For storage, use username if available, otherwise use displayName
    const username = telegramUsername || displayName

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
          'Get the code from the memU bot app (Settings → Security).',
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
      // Try to get user avatar after successful bind
      const avatarUrl = await this.getUserAvatarUrl(userId)
      if (avatarUrl) {
        await securityService.updateUserAvatar(String(userId), 'telegram', avatarUrl)
        console.log(`[Telegram] User ${username} (${userId}) bound with avatar: ${avatarUrl}`)
      } else {
        console.log(`[Telegram] User ${username} (${userId}) successfully bound (no avatar)`)
      }
      // Show @username if available, otherwise show display name
      // Use code formatting for username to avoid Telegram parsing @ as mention entity
      const accountDisplay = telegramUsername ? `@${telegramUsername}` : displayName
      await this.bot?.sendMessage(
        chatId,
        `✅ Success! Your account ${accountDisplay} is now bound to this device.\n\n` +
          'You can now send messages to interact with the AI assistant.'
      )
    } else {
      console.log(`[Telegram] Bind failed for ${username}: ${result.error}`)
      await this.bot?.sendMessage(chatId, `❌ ${result.error}`)
    }
  }

  /**
   * Get user avatar URL from Telegram
   */
  private async getUserAvatarUrl(userId: number): Promise<string | undefined> {
    if (!this.bot) return undefined

    try {
      const photos = await this.bot.getUserProfilePhotos(userId, { limit: 1 })
      if (photos.total_count > 0 && photos.photos[0]?.length > 0) {
        // Get the smallest photo (last in array) for efficiency
        const photo = photos.photos[0][photos.photos[0].length - 1]
        return await this.bot.getFileLink(photo.file_id)
      }
    } catch (error) {
      console.log(`[Telegram] Could not get avatar for user ${userId}:`, error)
    }
    return undefined
  }

  /**
   * Update avatars and fix usernames for all bound Telegram users
   * Called on startup to refresh avatar URLs and fix "unknown" usernames
   */
  private async updateBoundUsersAvatars(): Promise<void> {
    if (!this.bot) return

    const boundUsers = await securityService.getBoundUsers('telegram')
    console.log(`[Telegram] Updating info for ${boundUsers.length} bound users`)

    for (const user of boundUsers) {
      try {
        const userId = user.userId || parseInt(user.uniqueId, 10)
        if (!userId || isNaN(userId)) continue

        // Fix "unknown" username if firstName is available
        if (user.username === 'unknown' && user.firstName) {
          const newUsername = user.lastName
            ? `${user.firstName} ${user.lastName}`
            : user.firstName
          await securityService.updateUsername(user.uniqueId, 'telegram', newUsername)
          console.log(`[Telegram] Fixed username: unknown -> ${newUsername}`)
        }

        // Update avatar
        const avatarUrl = await this.getUserAvatarUrl(userId)
        if (avatarUrl) {
          await securityService.updateUserAvatar(user.uniqueId, 'telegram', avatarUrl)
          console.log(`[Telegram] Updated avatar for ${user.firstName || user.username}: ${avatarUrl}`)
        }
      } catch (error) {
        console.error(`[Telegram] Failed to update info for ${user.username}:`, error)
      }
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
        'Use `/bind <security-code>` with a code from the memU bot app.',
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

    // Extract attachments and build message content
    const { attachments, imageUrls, filePaths } = await this.extractAttachments(msg)

    // Build the text content - include file paths for Agent to process
    let textContent = msg.text || msg.caption || ''
    if (filePaths.length > 0) {
      const fileInfo = filePaths.map(f => `- ${f.name} (${f.mimeType}): ${f.path}`).join('\n')
      const fileMessage = `\n\n[Attached files downloaded to local]:\n${fileInfo}`
      textContent = textContent ? textContent + fileMessage : fileMessage.trim()
    }

    // Store incoming message first
    const storedMsg: StoredTelegramMessage = {
      messageId: msg.message_id,
      chatId: msg.chat.id,
      fromId: msg.from?.id,
      fromUsername: msg.from?.username,
      fromFirstName: msg.from?.first_name,
      text: textContent || undefined,
      attachments: attachments.length > 0 ? attachments : undefined,
      date: msg.date,
      replyToMessageId: msg.reply_to_message?.message_id,
      isFromBot: false
    }
    await telegramStorage.storeMessage(storedMsg)
    console.log('[Telegram] Message stored:', storedMsg.messageId, attachments.length > 0 ? `with ${attachments.length} attachments` : '')

    // Track user message event for analytics
    const queryForAnalytics = attachments.length > 0
      ? `${textContent || ''} [attachments: ${attachments.map(a => a.name || a.contentType).join(', ')}]`.trim()
      : textContent || ''
    trackUserMessage(queryForAnalytics, 'telegram', msg.date * 1000)

    // Emit event for new message (to update UI)
    const appMessage = this.convertToAppMessage(storedMsg)
    appEvents.emitNewMessage(appMessage)

    // Publish incoming message event to infraService
    infraService.publish('message:incoming', {
      platform: 'telegram',
      timestamp: msg.date,
      message: { role: 'user', content: textContent || '' },
      metadata: {
        userId: msg.from?.id?.toString(),
        chatId: msg.chat.id.toString(),
        messageId: msg.message_id.toString(),
        imageUrls
      }
    })

    // Process with Agent and reply if there's content (text, images, or files)
    if ((textContent || imageUrls.length > 0 || filePaths.length > 0) && this.bot) {
      await this.processWithAgentAndReply(msg.chat.id, textContent, imageUrls)
    }
  }

  /**
   * Extract attachments from a Telegram message
   * Downloads files to local storage and returns paths for Agent to process
   */
  private async extractAttachments(msg: TelegramMessage): Promise<{
    attachments: StoredTelegramAttachment[]
    imageUrls: string[]
    filePaths: { path: string; name: string; mimeType: string }[]
  }> {
    const attachments: StoredTelegramAttachment[] = []
    const imageUrls: string[] = []
    const filePaths: { path: string; name: string; mimeType: string }[] = []

    if (!this.bot) {
      return { attachments, imageUrls, filePaths }
    }

    try {
      // Handle photos - get the largest size and download to local
      if (msg.photo && msg.photo.length > 0) {
        const photo = msg.photo[msg.photo.length - 1] // Largest photo
        const fileLink = await this.bot.getFileLink(photo.file_id)
        attachments.push({
          id: photo.file_id,
          name: 'photo.jpg',
          url: fileLink,
          contentType: 'image/jpeg',
          size: photo.file_size,
          width: photo.width,
          height: photo.height
        })
        
        // Download photo to local storage to avoid LLM URL fetch issues (robots.txt blocking)
        const localPath = await this.downloadFile(fileLink, 'photo.jpg')
        if (localPath) {
          imageUrls.push(localPath)
          console.log('[Telegram] Photo downloaded to local:', localPath)
        } else {
          // Fallback to URL if download fails
          imageUrls.push(fileLink)
          console.log('[Telegram] Photo attachment (URL fallback):', fileLink)
        }
      }

      // Handle documents (PDF, DOC, TXT, etc.) - download to local storage
      if (msg.document) {
        const doc = msg.document
        const fileLink = await this.bot.getFileLink(doc.file_id)
        const fileName = doc.file_name || 'document'
        const mimeType = doc.mime_type || 'application/octet-stream'

        attachments.push({
          id: doc.file_id,
          name: fileName,
          url: fileLink,
          contentType: mimeType,
          size: doc.file_size
        })
        console.log('[Telegram] Document attachment:', fileName, mimeType)

        // Download file to local storage for Agent to process
        const localPath = await this.downloadFile(fileLink, fileName)
        if (localPath) {
          filePaths.push({ path: localPath, name: fileName, mimeType })
        }
      }

      // Handle video - download to local for Agent to process
      if (msg.video) {
        const video = msg.video
        const fileLink = await this.bot.getFileLink(video.file_id)
        const mimeType = video.mime_type || 'video/mp4'
        attachments.push({
          id: video.file_id,
          name: 'video.mp4',
          url: fileLink,
          contentType: mimeType,
          size: video.file_size,
          width: video.width,
          height: video.height
        })
        console.log('[Telegram] Video attachment:', fileLink)
        
        // Download video to local storage for Agent to process
        const localPath = await this.downloadFile(fileLink, 'video.mp4')
        if (localPath) {
          filePaths.push({ path: localPath, name: 'video.mp4', mimeType })
          console.log('[Telegram] Video downloaded to local:', localPath)
        }
      }

      // Handle audio - download to local for Agent to process
      if (msg.audio) {
        const audio = msg.audio
        const fileLink = await this.bot.getFileLink(audio.file_id)
        const fileName = audio.title ? `${audio.title}.mp3` : 'audio.mp3'
        const mimeType = audio.mime_type || 'audio/mpeg'
        attachments.push({
          id: audio.file_id,
          name: fileName,
          url: fileLink,
          contentType: mimeType,
          size: audio.file_size
        })
        console.log('[Telegram] Audio attachment:', fileLink)
        
        // Download audio to local storage for Agent to process
        const localPath = await this.downloadFile(fileLink, fileName)
        if (localPath) {
          filePaths.push({ path: localPath, name: fileName, mimeType })
          console.log('[Telegram] Audio downloaded to local:', localPath)
        }
      }

      // Handle voice message - download to local for Agent to process
      if (msg.voice) {
        const voice = msg.voice
        const fileLink = await this.bot.getFileLink(voice.file_id)
        const mimeType = voice.mime_type || 'audio/ogg'
        attachments.push({
          id: voice.file_id,
          name: 'voice.ogg',
          url: fileLink,
          contentType: mimeType,
          size: voice.file_size
        })
        console.log('[Telegram] Voice attachment:', fileLink)
        
        // Download voice to local storage for Agent to process
        const localPath = await this.downloadFile(fileLink, 'voice.ogg')
        if (localPath) {
          filePaths.push({ path: localPath, name: 'voice.ogg', mimeType })
          console.log('[Telegram] Voice downloaded to local:', localPath)
        }
      }

      // Handle sticker
      if (msg.sticker) {
        const sticker = msg.sticker
        // Stickers can be static (webp) or animated (tgs/webm)
        if (!sticker.is_animated && !sticker.is_video) {
          const fileLink = await this.bot.getFileLink(sticker.file_id)
          const stickerName = sticker.set_name ? `${sticker.set_name}.webp` : 'sticker.webp'
          attachments.push({
            id: sticker.file_id,
            name: stickerName,
            url: fileLink,
            contentType: 'image/webp',
            size: sticker.file_size,
            width: sticker.width,
            height: sticker.height
          })
          
          // Download sticker to local storage
          const localPath = await this.downloadFile(fileLink, stickerName)
          if (localPath) {
            imageUrls.push(localPath)
            console.log('[Telegram] Sticker downloaded to local:', localPath)
          } else {
            imageUrls.push(fileLink)
            console.log('[Telegram] Sticker attachment (URL fallback):', fileLink)
          }
        }
      }
    } catch (error) {
      console.error('[Telegram] Error extracting attachments:', error)
    }

    return { attachments, imageUrls, filePaths }
  }

  /**
   * Download a file from Telegram to local storage
   * Returns the local file path or null if download failed
   */
  private async downloadFile(fileUrl: string, fileName: string): Promise<string | null> {
    try {
      // Create downloads directory in app data
      const downloadsDir = path.join(app.getPath('userData'), 'downloads', 'telegram')
      await fs.mkdir(downloadsDir, { recursive: true })

      // Generate unique filename with timestamp
      const timestamp = Date.now()
      const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
      const localPath = path.join(downloadsDir, `${timestamp}_${safeName}`)

      console.log(`[Telegram] Downloading file: ${fileName} -> ${localPath}`)
      
      const response = await fetch(fileUrl)
      if (!response.ok) {
        throw new Error(`Failed to download file: ${response.status}`)
      }

      const buffer = Buffer.from(await response.arrayBuffer())
      await fs.writeFile(localPath, buffer)
      
      console.log(`[Telegram] File downloaded: ${localPath} (${buffer.length} bytes)`)
      return localPath
    } catch (error) {
      console.error(`[Telegram] Error downloading file:`, error)
      return null
    }
  }

  /**
   * Process message with Agent and send reply
   */
  private async processWithAgentAndReply(chatId: number, userMessage: string, imageUrls: string[] = []): Promise<void> {
    console.log('[Telegram] Sending to Agent:', userMessage, imageUrls.length > 0 ? `with ${imageUrls.length} images` : '')

    // Set current chat ID for tool calls
    this.currentChatId = chatId

    try {
      // Check if message should be consumed by other services (e.g., proactive service)
      if (await infraService.tryConsumeUserInput(userMessage, 'telegram')) {
        console.log('[Telegram] Message consumed by another service, returning silently')
        return
      }

      // Get response from Agent with Telegram-specific tools and images
      const response = await agentService.processMessage(userMessage, 'telegram', imageUrls)

      // Check if rejected due to processing lock
      if (!response.success && response.busyWith) {
        console.log(`[Telegram] Agent is busy with ${response.busyWith}`)
        if (response.message) {
          await this.sendText(chatId, response.message, { storeInHistory: false })
        }
        return
      }

      if (response.success && response.message) {
        console.log('[Telegram] Agent response:', response.message.substring(0, 100) + '...')

        // Convert Markdown to Telegram HTML for proper formatting
        const htmlMessage = markdownToTelegramHtml(response.message)

        // Send reply to Telegram with HTML formatting
        const sentMsg = await this.bot!.sendMessage(chatId, htmlMessage, { parse_mode: 'HTML' })
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

        // Publish outgoing message event to infraService
        infraService.publish('message:outgoing', {
          platform: 'telegram',
          timestamp: botReply.date,
          message: { role: 'assistant', content: response.message },
          metadata: {
            messageId: sentMsg.message_id.toString()
          }
        })
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
      attachments: msg.attachments?.map(att => ({
        id: att.id,
        name: att.name,
        url: att.url,
        contentType: att.contentType,
        size: att.size || 0,
        width: att.width,
        height: att.height
      })),
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
   * By default, converts Markdown to HTML for stable formatting
   * @param storeInHistory - Whether to store message in history (default: true)
   */
  async sendText(
    chatId: number,
    text: string,
    options?: { parse_mode?: 'Markdown' | 'HTML' | 'none'; reply_to_message_id?: number; storeInHistory?: boolean }
  ): Promise<{ success: boolean; messageId?: number; message?: TelegramBot.Message; error?: string }> {
    if (!this.bot) {
      return { success: false, error: 'Bot not connected' }
    }
    try {
      // By default, convert Markdown to HTML for stable formatting
      // Use parse_mode: 'none' to send plain text without any formatting
      let finalText = text
      let parseMode: 'Markdown' | 'HTML' | undefined = undefined

      if (options?.parse_mode === 'none') {
        // Plain text, no conversion
        finalText = text
        parseMode = undefined
      } else if (options?.parse_mode === 'Markdown') {
        // Use legacy Markdown (not recommended, kept for compatibility)
        finalText = text
        parseMode = 'Markdown'
      } else {
        // Default: convert Markdown to HTML (most stable)
        finalText = markdownToTelegramHtml(text)
        parseMode = 'HTML'
      }

      const sendOptions: TelegramBot.SendMessageOptions = {}
      if (parseMode) sendOptions.parse_mode = parseMode
      if (options?.reply_to_message_id) sendOptions.reply_to_message_id = options.reply_to_message_id

      const msg = await this.bot.sendMessage(chatId, finalText, sendOptions)

      // Store message in history (default: true)
      const shouldStore = options?.storeInHistory !== false
      if (shouldStore) {
        const storedMsg: StoredTelegramMessage = {
          messageId: msg.message_id,
          chatId: msg.chat.id,
          fromId: msg.from?.id,
          fromUsername: msg.from?.username,
          fromFirstName: msg.from?.first_name || 'Bot',
          text: text, // Store original text, not converted
          date: msg.date,
          isFromBot: true
        }
        await telegramStorage.storeMessage(storedMsg)
        
        // Emit event for UI update
        const appMessage = this.convertToAppMessage(storedMsg)
        appEvents.emitNewMessage(appMessage)
      }

      return { success: true, messageId: msg.message_id, message: msg }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  }

  /**
   * Send a photo
   * Caption is automatically converted from Markdown to HTML
   */
  async sendPhoto(
    chatId: number,
    photo: string | Buffer,
    options?: { caption?: string; filename?: string }
  ): Promise<{ success: boolean; messageId?: number; message?: TelegramBot.Message; error?: string }> {
    if (!this.bot) {
      return { success: false, error: 'Bot not connected' }
    }
    try {
      const sendOptions: TelegramBot.SendPhotoOptions = {}
      // Auto-convert caption Markdown to HTML
      if (options?.caption) {
        sendOptions.caption = markdownToTelegramHtml(options.caption)
        sendOptions.parse_mode = 'HTML'
      }
      const fileOptions: TelegramBot.FileOptions = {
        contentType: 'image/png' // Default to PNG, covers most cases
      }
      if (options?.filename) {
        fileOptions.filename = options.filename
        // Detect content type from filename
        const ext = options.filename.toLowerCase().split('.').pop()
        if (ext === 'jpg' || ext === 'jpeg') fileOptions.contentType = 'image/jpeg'
        else if (ext === 'gif') fileOptions.contentType = 'image/gif'
        else if (ext === 'webp') fileOptions.contentType = 'image/webp'
      }
      // Set content length for Buffer to display correct file size
      if (Buffer.isBuffer(photo)) {
        ;(fileOptions as TelegramBot.FileOptions & { contentLength?: number }).contentLength = photo.length
      }
      const msg = await this.bot.sendPhoto(chatId, photo, sendOptions, fileOptions)
      return { success: true, messageId: msg.message_id, message: msg }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  }

  /**
   * Send a document/file
   * Caption is automatically converted from Markdown to HTML
   */
  async sendDocument(
    chatId: number,
    document: string | Buffer,
    options?: { caption?: string; filename?: string }
  ): Promise<{ success: boolean; messageId?: number; message?: TelegramBot.Message; error?: string }> {
    if (!this.bot) {
      return { success: false, error: 'Bot not connected' }
    }
    try {
      const sendOptions: TelegramBot.SendDocumentOptions = {}
      if (options?.caption) {
        sendOptions.caption = markdownToTelegramHtml(options.caption)
        sendOptions.parse_mode = 'HTML'
      }
      const fileOptions: TelegramBot.FileOptions = {
        contentType: 'application/octet-stream'
      }
      if (options?.filename) fileOptions.filename = options.filename
      // Set content length for Buffer to display correct file size
      if (Buffer.isBuffer(document)) {
        ;(fileOptions as TelegramBot.FileOptions & { contentLength?: number }).contentLength = document.length
      }
      const msg = await this.bot.sendDocument(chatId, document, sendOptions, fileOptions)
      return { success: true, messageId: msg.message_id, message: msg }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  }

  /**
   * Send a video
   * Caption is automatically converted from Markdown to HTML
   */
  async sendVideo(
    chatId: number,
    video: string | Buffer,
    options?: { caption?: string; duration?: number; width?: number; height?: number; filename?: string }
  ): Promise<{ success: boolean; messageId?: number; message?: TelegramBot.Message; error?: string }> {
    if (!this.bot) {
      return { success: false, error: 'Bot not connected' }
    }
    try {
      const sendOptions: TelegramBot.SendVideoOptions = {}
      if (options?.caption) {
        sendOptions.caption = markdownToTelegramHtml(options.caption)
        sendOptions.parse_mode = 'HTML'
      }
      if (options?.duration) sendOptions.duration = options.duration
      if (options?.width) sendOptions.width = options.width
      if (options?.height) sendOptions.height = options.height
      const fileOptions: TelegramBot.FileOptions = {
        contentType: 'video/mp4'
      }
      if (options?.filename) fileOptions.filename = options.filename
      // Set content length for Buffer to display correct file size
      if (Buffer.isBuffer(video)) {
        ;(fileOptions as TelegramBot.FileOptions & { contentLength?: number }).contentLength = video.length
      }
      const msg = await this.bot.sendVideo(chatId, video, sendOptions, fileOptions)
      return { success: true, messageId: msg.message_id, message: msg }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  }

  /**
   * Send an audio file
   * Caption is automatically converted from Markdown to HTML
   */
  async sendAudio(
    chatId: number,
    audio: string | Buffer,
    options?: { caption?: string; duration?: number; performer?: string; title?: string; filename?: string }
  ): Promise<{ success: boolean; messageId?: number; message?: TelegramBot.Message; error?: string }> {
    if (!this.bot) {
      return { success: false, error: 'Bot not connected' }
    }
    try {
      const sendOptions: TelegramBot.SendAudioOptions = {}
      if (options?.caption) {
        sendOptions.caption = markdownToTelegramHtml(options.caption)
        sendOptions.parse_mode = 'HTML'
      }
      if (options?.duration) sendOptions.duration = options.duration
      if (options?.performer) sendOptions.performer = options.performer
      if (options?.title) sendOptions.title = options.title
      const fileOptions: TelegramBot.FileOptions = {
        contentType: 'audio/mpeg'
      }
      if (options?.filename) {
        fileOptions.filename = options.filename
        const ext = options.filename.toLowerCase().split('.').pop()
        if (ext === 'ogg' || ext === 'oga') fileOptions.contentType = 'audio/ogg'
        else if (ext === 'wav') fileOptions.contentType = 'audio/wav'
        else if (ext === 'flac') fileOptions.contentType = 'audio/flac'
        else if (ext === 'm4a') fileOptions.contentType = 'audio/mp4'
      }
      // Set content length for Buffer to display correct file size
      if (Buffer.isBuffer(audio)) {
        ;(fileOptions as TelegramBot.FileOptions & { contentLength?: number }).contentLength = audio.length
      }
      const msg = await this.bot.sendAudio(chatId, audio, sendOptions, fileOptions)
      return { success: true, messageId: msg.message_id, message: msg }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  }

  /**
   * Send a voice message
   * Caption is automatically converted from Markdown to HTML
   */
  async sendVoice(
    chatId: number,
    voice: string | Buffer,
    options?: { caption?: string; duration?: number; filename?: string }
  ): Promise<{ success: boolean; messageId?: number; message?: TelegramBot.Message; error?: string }> {
    if (!this.bot) {
      return { success: false, error: 'Bot not connected' }
    }
    try {
      const sendOptions: TelegramBot.SendVoiceOptions = {}
      if (options?.caption) {
        sendOptions.caption = markdownToTelegramHtml(options.caption)
        sendOptions.parse_mode = 'HTML'
      }
      if (options?.duration) sendOptions.duration = options.duration
      const fileOptions: TelegramBot.FileOptions = {
        contentType: 'audio/ogg'
      }
      if (options?.filename) fileOptions.filename = options.filename
      // Set content length for Buffer to display correct file size
      if (Buffer.isBuffer(voice)) {
        ;(fileOptions as TelegramBot.FileOptions & { contentLength?: number }).contentLength = voice.length
      }
      const msg = await this.bot.sendVoice(chatId, voice, sendOptions, fileOptions)
      return { success: true, messageId: msg.message_id, message: msg }
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
  ): Promise<{ success: boolean; messageId?: number; message?: TelegramBot.Message; error?: string }> {
    if (!this.bot) {
      return { success: false, error: 'Bot not connected' }
    }
    try {
      const sendOptions: TelegramBot.SendStickerOptions = {}
      const fileOptions: TelegramBot.FileOptions = {
        contentType: 'application/octet-stream'
      }
      if (options?.filename) {
        fileOptions.filename = options.filename
        const ext = options.filename.toLowerCase().split('.').pop()
        if (ext === 'webp') fileOptions.contentType = 'image/webp'
        else if (ext === 'png') fileOptions.contentType = 'image/png'
        else if (ext === 'tgs') fileOptions.contentType = 'application/x-tgsticker'
      }
      const msg = await this.bot.sendSticker(chatId, sticker, sendOptions, fileOptions)
      return { success: true, messageId: msg.message_id, message: msg }
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
  ): Promise<{ success: boolean; messageId?: number; message?: TelegramBot.Message; error?: string }> {
    if (!this.bot) {
      return { success: false, error: 'Bot not connected' }
    }
    try {
      const msg = await this.bot.sendLocation(chatId, latitude, longitude)
      return { success: true, messageId: msg.message_id, message: msg }
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
  ): Promise<{ success: boolean; messageId?: number; message?: TelegramBot.Message; error?: string }> {
    if (!this.bot) {
      return { success: false, error: 'Bot not connected' }
    }
    try {
      const msg = await this.bot.sendContact(chatId, phoneNumber, firstName, options)
      return { success: true, messageId: msg.message_id, message: msg }
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
  ): Promise<{ success: boolean; messageId?: number; message?: TelegramBot.Message; error?: string }> {
    if (!this.bot) {
      return { success: false, error: 'Bot not connected' }
    }
    try {
      const msg = await this.bot.sendPoll(chatId, question, pollOptions, options)
      return { success: true, messageId: msg.message_id, message: msg }
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
