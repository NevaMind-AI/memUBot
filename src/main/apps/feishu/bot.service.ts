import * as lark from '@larksuiteoapi/node-sdk'
import { feishuStorage } from './storage'
import { getSetting } from '../../config/settings.config'
import { agentService } from '../../services/agent.service'
import { infraService } from '../../services/infra.service'
import { securityService } from '../../services/security.service'
import { trackUserMessage } from '../../services/analytics.service'
import { appEvents } from '../../events'
import { app } from 'electron'
import * as fs from 'fs/promises'
import * as path from 'path'
import type { BotStatus, AppMessage } from '../types'
import type { StoredFeishuMessage, StoredFeishuAttachment, FeishuMessageEvent } from './types'

/**
 * FeishuBotService manages the Feishu bot connection and message handling
 * Uses WebSocket (WSClient) for real-time message receiving
 */
export class FeishuBotService {
  private client: lark.Client | null = null
  private wsClient: lark.WSClient | null = null
  private status: BotStatus = {
    platform: 'feishu',
    isConnected: false
  }
  private currentChatId: string | null = null
  private botOpenId: string | null = null
  
  // Deduplication: track processed message IDs to avoid duplicate processing
  // This is needed because Feishu SDK may redeliver messages on WebSocket reconnect
  private processedMessageIds: Set<string> = new Set()
  private readonly MAX_PROCESSED_IDS = 1000 // Limit memory usage
  
  // Track chatType per chatId so bot replies can use the correct type
  private chatTypeMap: Map<string, 'p2p' | 'group'> = new Map()

  /**
   * Connect to Feishu using WebSocket
   */
  async connect(): Promise<void> {
    try {
      console.log('[Feishu] Starting connection...')

      const appId = await getSetting('feishuAppId')
      const appSecret = await getSetting('feishuAppSecret')

      if (!appId || !appSecret) {
        throw new Error('Feishu App ID and App Secret not configured. Please set them in Settings.')
      }

      // Initialize storage
      await feishuStorage.initialize()
      console.log('[Feishu] Storage initialized')

      // Create API client for sending messages
      this.client = new lark.Client({
        appId,
        appSecret,
        appType: lark.AppType.SelfBuild,
        domain: lark.Domain.Feishu
      })

      // Get application info (name and avatar)
      try {
        const appInfo = await this.client.application.application.get({
          params: { lang: 'zh_cn' },
          path: { app_id: appId }
        })

        if (appInfo.data?.app) {
          this.status.botName = appInfo.data.app.app_name || 'Feishu Bot'
          this.status.avatarUrl = appInfo.data.app.avatar_url
          console.log(`[Feishu] App info: ${this.status.botName}, avatar: ${this.status.avatarUrl ? 'yes' : 'no'}`)
        }
      } catch (appInfoError) {
        // Could not get app info - use default name
        console.log('[Feishu] Could not get app info, using default name')
        this.status.botName = 'Feishu Bot'
      }

      // Create WebSocket client for receiving messages
      this.wsClient = new lark.WSClient({
        appId,
        appSecret,
        loggerLevel: lark.LoggerLevel.info
      })

      // Start WebSocket connection with event dispatcher
      this.wsClient.start({
        eventDispatcher: new lark.EventDispatcher({}).register({
          'im.message.receive_v1': async (data) => {
            await this.handleMessageEvent(data as unknown as FeishuMessageEvent)
          }
        })
      })

      this.status = {
        ...this.status,
        platform: 'feishu',
        isConnected: true
      }

      console.log('[Feishu] Bot connected successfully via WebSocket')
      appEvents.emitFeishuStatusChanged(this.status)

      // Update bound users avatars
      this.updateBoundUsersAvatars().catch((err) => {
        console.error('[Feishu] Error updating bound users avatars:', err)
      })
    } catch (error) {
      console.error('[Feishu] Connection error:', error)
      this.status = {
        platform: 'feishu',
        isConnected: false,
        error: error instanceof Error ? error.message : String(error)
      }
      appEvents.emitFeishuStatusChanged(this.status)
      throw error
    }
  }

  /**
   * Handle incoming message event from WebSocket
   */
  private async handleMessageEvent(event: FeishuMessageEvent): Promise<void> {
    const messageId = event.message.message_id
    
    // Deduplication: skip if already processed
    if (this.processedMessageIds.has(messageId)) {
      console.log(`[Feishu] Skipping duplicate message: ${messageId}`)
      return
    }
    
    // Add to processed set
    this.processedMessageIds.add(messageId)
    
    // Cleanup old IDs if set is too large
    if (this.processedMessageIds.size > this.MAX_PROCESSED_IDS) {
      const idsArray = Array.from(this.processedMessageIds)
      // Remove oldest half
      for (let i = 0; i < this.MAX_PROCESSED_IDS / 2; i++) {
        this.processedMessageIds.delete(idsArray[i])
      }
      console.log(`[Feishu] Cleaned up processed message IDs, now ${this.processedMessageIds.size} entries`)
    }
    
    console.log('[Feishu] ========== MESSAGE RECEIVED ==========')
    console.log('[Feishu] Message ID:', messageId)
    console.log('[Feishu] From:', event.sender.sender_id.open_id)
    console.log('[Feishu] Chat Type:', event.message.chat_type)
    console.log('[Feishu] Message Type:', event.message.message_type)
    console.log('[Feishu] Raw Content:', event.message.content)
    console.log('[Feishu] ======================================')

    try {
      const senderId = event.sender.sender_id.open_id
      const chatId = event.message.chat_id
      const messageContent = JSON.parse(event.message.content)

      // Check for /bind command
      if (event.message.message_type === 'text' && messageContent.text?.startsWith('/bind')) {
        await this.handleBindCommand(event, messageContent.text)
        return
      }

      // Check if user is authorized
      const isAuthorized = await securityService.isAuthorizedByStringId(senderId, 'feishu')
      if (!isAuthorized) {
        console.log(`[Feishu] Unauthorized user ${senderId}, sending error message`)
        await this.sendUnauthorizedMessage(chatId)
        return
      }

      await this.handleIncomingMessage(event)
      console.log('[Feishu] Message processed successfully')
    } catch (error) {
      console.error('[Feishu] Error handling message:', error)
    }
  }

  /**
   * Handle /bind command
   */
  private async handleBindCommand(event: FeishuMessageEvent, text: string): Promise<void> {
    const senderId = event.sender.sender_id.open_id
    const chatId = event.message.chat_id

    // Check if already bound
    const isAlreadyBound = await securityService.isAuthorizedByStringId(senderId, 'feishu')
    if (isAlreadyBound) {
      await this.sendText(chatId, '✅ Your account is already bound to this device.', { storeInHistory: false })
      return
    }

    // Extract security code
    const parts = text.split(' ')
    if (parts.length < 2) {
      await this.sendText(
        chatId,
        '🔐 Please provide a security code:\n\n`/bind <6-digit-code>`\n\nGet the code from the memU bot app (Settings → Security).',
        { storeInHistory: false }
      )
      return
    }

    const code = parts[1].trim()

    // Get user info for username
    let username = senderId
    try {
      if (this.client) {
        const userInfo = await this.client.contact.user.get({
          params: { user_id_type: 'open_id' },
          path: { user_id: senderId }
        })
        if (userInfo.data?.user?.name) {
          username = userInfo.data.user.name
        }
      }
    } catch (e) {
      console.log('[Feishu] Could not get user info:', e)
    }

    // Validate and bind
    const result = await securityService.validateAndBindByStringId(
      code,
      senderId,
      username,
      undefined,
      undefined,
      'feishu'
    )

    if (result.success) {
      // Try to get user avatar
      const avatarUrl = await this.getUserAvatarUrl(senderId)
      if (avatarUrl) {
        await securityService.updateUserAvatar(senderId, 'feishu', avatarUrl)
      }
      await this.sendText(
        chatId,
        `✅ Success! Your account ${username} is now bound to this device.\n\nYou can now send messages to interact with the AI assistant.`,
        { storeInHistory: false }
      )
    } else {
      await this.sendText(chatId, `❌ ${result.error}`, { storeInHistory: false })
    }
  }

  /**
   * Get user info (name and avatar)
   */
  private async getUserInfo(
    openId: string
  ): Promise<{ name?: string; avatarUrl?: string } | undefined> {
    if (!this.client) return undefined
    try {
      const userInfo = await this.client.contact.user.get({
        params: { user_id_type: 'open_id' },
        path: { user_id: openId }
      })
      return {
        name: userInfo.data?.user?.name,
        avatarUrl: userInfo.data?.user?.avatar?.avatar_origin
      }
    } catch (error) {
      // This typically fails when user is not in app's contact scope
      console.log(
        `[Feishu] Could not get user info for ${openId} (user may not be in app's contact scope)`
      )
      return undefined
    }
  }

  /**
   * Get user avatar URL (for backward compatibility)
   */
  private async getUserAvatarUrl(openId: string): Promise<string | undefined> {
    const info = await this.getUserInfo(openId)
    return info?.avatarUrl
  }

  /**
   * Update info for bound users (name and avatar)
   */
  private async updateBoundUsersAvatars(): Promise<void> {
    const boundUsers = await securityService.getBoundUsers('feishu')
    console.log(`[Feishu] Updating info for ${boundUsers.length} bound users`)

    for (const user of boundUsers) {
      try {
        const info = await this.getUserInfo(user.uniqueId)
        if (info) {
          if (info.name) {
            await securityService.updateUsername(user.uniqueId, 'feishu', info.name)
            console.log(`[Feishu] Updated username for ${user.uniqueId}: ${info.name}`)
          }
          if (info.avatarUrl) {
            await securityService.updateUserAvatar(user.uniqueId, 'feishu', info.avatarUrl)
            console.log(`[Feishu] Updated avatar for ${info.name || user.uniqueId}`)
          }
        }
      } catch (error) {
        console.error(`[Feishu] Failed to update info for ${user.username}:`, error)
      }
    }
  }

  /**
   * Send unauthorized message
   */
  private async sendUnauthorizedMessage(chatId: string): Promise<void> {
    await this.sendText(
      chatId,
      '🔒 This bot is private.\n\nTo use this bot, you need to bind your account first.\nUse `/bind <security-code>` with a code from the memU bot app.',
      { storeInHistory: false }
    )
  }

  /**
   * Handle incoming message
   */
  private async handleIncomingMessage(event: FeishuMessageEvent): Promise<void> {
    console.log('[Feishu] Processing message...')

    const messageContent = JSON.parse(event.message.content)
    const chatId = event.message.chat_id
    const chatType = (event.message.chat_type === 'group' ? 'group' : 'p2p') as 'p2p' | 'group'
    const senderId = event.sender.sender_id.open_id

    // Remember chatType for this chatId so bot replies use the correct type
    this.chatTypeMap.set(chatId, chatType)

    // Extract attachments and text
    const { attachments, imageUrls, filePaths, text } = await this.extractMessageContent(
      event.message.message_type,
      messageContent,
      event.message.message_id
    )

    // Get sender name and update bound user info if needed
    let senderName = senderId
    try {
      if (this.client) {
        const userInfo = await this.client.contact.user.get({
          params: { user_id_type: 'open_id' },
          path: { user_id: senderId }
        })
        if (userInfo.data?.user?.name) {
          senderName = userInfo.data.user.name
          // Update bound user's username and avatar if available
          await securityService.updateUsername(senderId, 'feishu', senderName)
          const avatarUrl = userInfo.data.user.avatar?.avatar_origin
          if (avatarUrl) {
            await securityService.updateUserAvatar(senderId, 'feishu', avatarUrl)
          }
        }
      }
    } catch (e) {
      // Contact permission not granted - use open_id as fallback
      console.log('[Feishu] Could not get sender name (contact permission may be required)')
    }

    // Build message for Agent
    let agentMessage = text || ''
    if (filePaths.length > 0) {
      const fileInfo = filePaths.map((f) => `- ${f.name} (${f.mimeType}): ${f.path}`).join('\n')
      const fileMessage = `\n\n[Attached files - use file_read tool to read content]:\n${fileInfo}`
      agentMessage = agentMessage ? agentMessage + fileMessage : fileMessage.trim()
    }

    // Store incoming message
    const storedMsg: StoredFeishuMessage = {
      messageId: event.message.message_id,
      chatId,
      chatType: event.message.chat_type,
      fromId: senderId,
      fromName: senderName,
      text: agentMessage || undefined,
      attachments: attachments.length > 0 ? attachments : undefined,
      date: Math.floor(parseInt(event.message.create_time) / 1000),
      replyToMessageId: event.message.parent_id,
      isFromBot: false
    }
    await feishuStorage.storeMessage(storedMsg)
    console.log('[Feishu] Message stored:', storedMsg.messageId)

    // Track user message event for analytics
    const queryForAnalytics = attachments.length > 0
      ? `${agentMessage || ''} [attachments: ${attachments.map(a => a.name || a.contentType).join(', ')}]`.trim()
      : agentMessage || ''
    trackUserMessage(queryForAnalytics, 'feishu', parseInt(event.message.create_time))

    // Emit event for UI
    const appMessage = this.convertToAppMessage(storedMsg)
    appEvents.emitFeishuNewMessage(appMessage)

    // Publish incoming message event to infraService
    infraService.publish('message:incoming', {
      platform: 'feishu',
      timestamp: storedMsg.date,
      message: { role: 'user', content: agentMessage || '' },
      metadata: {
        userId: senderId,
        chatId,
        messageId: event.message.message_id,
        imageUrls
      }
    })

    // Process with Agent
    if ((agentMessage || imageUrls.length > 0) && this.client) {
      await this.processWithAgentAndReply(chatId, agentMessage, imageUrls)
    }
  }

  /**
   * Extract content from message based on type
   */
  private async extractMessageContent(
    messageType: string,
    content: Record<string, unknown>,
    messageId: string
  ): Promise<{
    attachments: StoredFeishuAttachment[]
    imageUrls: string[]
    filePaths: { path: string; name: string; mimeType: string }[]
    text: string | null
  }> {
    const attachments: StoredFeishuAttachment[] = []
    const imageUrls: string[] = []
    const filePaths: { path: string; name: string; mimeType: string }[] = []
    let text: string | null = null

    switch (messageType) {
      case 'text':
        text = (content.text as string) || null
        break

      case 'image':
        if (content.image_key && this.client) {
          try {
            const imageKey = content.image_key as string
            // Download image
            const localPath = await this.downloadImage(imageKey, messageId)
            if (localPath) {
              attachments.push({
                id: imageKey,
                name: `image_${imageKey}.png`,
                url: localPath,
                contentType: 'image/png'
              })
              imageUrls.push(localPath)
            }
          } catch (e) {
            console.error('[Feishu] Failed to download image:', e)
          }
        }
        break

      case 'file':
        if (content.file_key && content.file_name && this.client) {
          try {
            const fileKey = content.file_key as string
            const fileName = content.file_name as string
            const localPath = await this.downloadFile(fileKey, fileName, messageId)
            if (localPath) {
              const mimeType = this.getMimeType(fileName)
              attachments.push({
                id: fileKey,
                name: fileName,
                url: localPath,
                contentType: mimeType
              })
              filePaths.push({ path: localPath, name: fileName, mimeType })
            }
          } catch (e) {
            console.error('[Feishu] Failed to download file:', e)
          }
        }
        break

      case 'post':
        // Rich text - extract text and images from content
        // Post content can be nested under language keys (zh_cn, en_us, etc.) or directly at root level
        try {
          // Define the structure type for post content
          type PostElement = { tag: string; text?: string; image_key?: string }
          type PostContentBody = { title?: string; content?: Array<Array<PostElement>> }
          
          // Try to get content body - might be nested under language keys or at root
          let postBody: PostContentBody | undefined
          const rawContent = content as Record<string, unknown>
          
          // Check if content is nested under language keys (zh_cn, en_us, ja_jp, etc.)
          const langKeys = ['zh_cn', 'en_us', 'ja_jp', 'zh_hk', 'zh_tw']
          for (const langKey of langKeys) {
            if (rawContent[langKey] && typeof rawContent[langKey] === 'object') {
              postBody = rawContent[langKey] as PostContentBody
              console.log(`[Feishu] Found post content under language key: ${langKey}`)
              break
            }
          }
          
          // If not found under language keys, try root level
          if (!postBody && rawContent.content) {
            postBody = rawContent as PostContentBody
            console.log('[Feishu] Found post content at root level')
          }
          
          if (postBody) {
            const parts: string[] = []
            const imageKeys: string[] = []
            
            if (postBody.title) parts.push(postBody.title)
            
            if (postBody.content) {
              for (const paragraph of postBody.content) {
                for (const element of paragraph) {
                  if (element.tag === 'text' && element.text) {
                    parts.push(element.text)
                  } else if (element.tag === 'img' && element.image_key) {
                    // Found image in rich text
                    imageKeys.push(element.image_key)
                    console.log(`[Feishu] Found image in post content: ${element.image_key}`)
                  }
                }
              }
            }
            
            text = parts.join('\n')
            
            // Download images found in post content
            for (const imageKey of imageKeys) {
              try {
                const localPath = await this.downloadImage(imageKey, messageId)
                if (localPath) {
                  attachments.push({
                    id: imageKey,
                    name: `image_${imageKey}.png`,
                    url: localPath,
                    contentType: 'image/png'
                  })
                  imageUrls.push(localPath)
                }
              } catch (e) {
                console.error(`[Feishu] Failed to download post image ${imageKey}:`, e)
              }
            }
          }
        } catch (e) {
          console.error('[Feishu] Failed to parse post content:', e)
        }
        break
    }

    return { attachments, imageUrls, filePaths, text }
  }

  /**
   * Get MIME type from filename
   */
  private getMimeType(fileName: string): string {
    const ext = fileName.toLowerCase().split('.').pop() || ''
    const mimeTypes: Record<string, string> = {
      pdf: 'application/pdf',
      doc: 'application/msword',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      xls: 'application/vnd.ms-excel',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ppt: 'application/vnd.ms-powerpoint',
      pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      txt: 'text/plain',
      json: 'application/json',
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      gif: 'image/gif',
      mp4: 'video/mp4',
      mp3: 'audio/mpeg'
    }
    return mimeTypes[ext] || 'application/octet-stream'
  }

  /**
   * Download image from Feishu
   */
  private async downloadImage(imageKey: string, messageId: string): Promise<string | null> {
    if (!this.client) return null

    try {
      const downloadsDir = path.join(app.getPath('userData'), 'downloads', 'feishu')
      await fs.mkdir(downloadsDir, { recursive: true })

      // Download to temp path first (without extension)
      const tempPath = path.join(downloadsDir, `${Date.now()}_${imageKey}.tmp`)

      const response = await this.client.im.messageResource.get({
        path: {
          message_id: messageId,
          file_key: imageKey
        },
        params: {
          type: 'image'
        }
      })

      if (response) {
        await response.writeFile(tempPath)
        
        // Detect actual image format from magic bytes
        const imageData = await fs.readFile(tempPath)
        let ext = 'png' // default
        if (imageData[0] === 0xff && imageData[1] === 0xd8 && imageData[2] === 0xff) {
          ext = 'jpg'
        } else if (imageData[0] === 0x89 && imageData[1] === 0x50 && imageData[2] === 0x4e && imageData[3] === 0x47) {
          ext = 'png'
        } else if (imageData[0] === 0x47 && imageData[1] === 0x49 && imageData[2] === 0x46) {
          ext = 'gif'
        } else if (imageData[0] === 0x52 && imageData[1] === 0x49 && imageData[2] === 0x46 && imageData[3] === 0x46 &&
                   imageData[8] === 0x57 && imageData[9] === 0x45 && imageData[10] === 0x42 && imageData[11] === 0x50) {
          ext = 'webp'
        }
        
        // Rename to correct extension
        const localPath = path.join(downloadsDir, `${Date.now()}_${imageKey}.${ext}`)
        await fs.rename(tempPath, localPath)
        
        console.log(`[Feishu] Image downloaded (${ext}): ${localPath}`)
        return localPath
      }
    } catch (error) {
      console.error('[Feishu] Error downloading image:', error)
    }
    return null
  }

  /**
   * Download file from Feishu
   */
  private async downloadFile(fileKey: string, fileName: string, messageId: string): Promise<string | null> {
    if (!this.client) return null

    try {
      const downloadsDir = path.join(app.getPath('userData'), 'downloads', 'feishu')
      await fs.mkdir(downloadsDir, { recursive: true })

      const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
      const localPath = path.join(downloadsDir, `${Date.now()}_${safeName}`)

      const response = await this.client.im.messageResource.get({
        path: {
          message_id: messageId,
          file_key: fileKey
        },
        params: {
          type: 'file'
        }
      })

      if (response) {
        await response.writeFile(localPath)
        console.log(`[Feishu] File downloaded: ${localPath}`)
        return localPath
      }
    } catch (error) {
      console.error('[Feishu] Error downloading file:', error)
    }
    return null
  }

  /**
   * Process message with Agent and send reply
   */
  private async processWithAgentAndReply(
    chatId: string,
    userMessage: string,
    imageUrls: string[] = []
  ): Promise<void> {
    console.log('[Feishu] Sending to Agent:', userMessage.substring(0, 100) + '...')

    this.currentChatId = chatId

    try {
      // Check if message should be consumed by other services (e.g., proactive service)
      if (await infraService.tryConsumeUserInput(userMessage, 'feishu')) {
        console.log('[Feishu] Message consumed by another service, returning silently')
        return
      }

      const response = await agentService.processMessage(userMessage, 'feishu', imageUrls, chatId)

      // Check if rejected due to processing lock
      if (!response.success && response.busyWith) {
        console.log(`[Feishu] Agent is busy with ${response.busyWith}`)
        if (response.message) {
          await this.sendText(chatId, response.message, { storeInHistory: false })
        }
        return
      }

      if (response.success && response.message) {
        console.log('[Feishu] Agent response:', response.message.substring(0, 100) + '...')
        // Use sendMarkdown for better formatting (interactive card with markdown support)
        const result = await this.sendMarkdown(chatId, response.message, { storeInHistory: false })

        if (result.success && result.messageId) {
          // Store bot's reply
          const botReply: StoredFeishuMessage = {
            messageId: result.messageId,
            chatId,
            chatType: this.chatTypeMap.get(chatId) || 'p2p',
            fromId: this.botOpenId || 'bot',
            fromName: this.status.botName || 'Bot',
            text: response.message,
            date: Math.floor(Date.now() / 1000),
            isFromBot: true
          }
          await feishuStorage.storeMessage(botReply)

          const appMessage = this.convertToAppMessage(botReply)
          appEvents.emitFeishuNewMessage(appMessage)

          // Publish outgoing message event to infraService
          infraService.publish('message:outgoing', {
            platform: 'feishu',
            timestamp: botReply.date,
            message: { role: 'assistant', content: response.message },
            metadata: {
              messageId: result.messageId
            }
          })
        }
      } else {
        console.error('[Feishu] Agent error:', response.error)
        await this.sendText(chatId, `Error: ${response.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('[Feishu] Error processing with Agent:', error)
      await this.sendText(chatId, 'Sorry, something went wrong.')
    }
  }

  /**
   * Disconnect from Feishu
   */
  async disconnect(): Promise<void> {
    // WSClient doesn't have a stop method, but we can nullify the references
    this.wsClient = null
    this.client = null
    this.status = {
      platform: 'feishu',
      isConnected: false
    }
    appEvents.emitFeishuStatusChanged(this.status)
    console.log('[Feishu] Disconnected')
  }

  /**
   * Get bot status
   */
  getStatus(): BotStatus {
    return this.status
  }

  /**
   * Get all messages
   */
  async getMessages(limit = 200): Promise<AppMessage[]> {
    const messages = await feishuStorage.getMessages(limit)
    return messages.map((msg) => this.convertToAppMessage(msg))
  }

  /**
   * Convert stored message to AppMessage
   */
  private convertToAppMessage(msg: StoredFeishuMessage): AppMessage {
    return {
      id: msg.messageId,
      platform: 'feishu',
      chatId: msg.chatId,
      senderId: msg.fromId,
      senderName: msg.fromName || 'Unknown',
      content: msg.text || '',
      attachments: msg.attachments?.map((att) => ({
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
      replyToId: msg.replyToMessageId
    }
  }

  /**
   * Get current chat ID
   */
  getCurrentChatId(): string | null {
    return this.currentChatId
  }

  /**
   * Get API client
   */
  getClient(): lark.Client | null {
    return this.client
  }

  // ========== Public Media Sending Methods ==========

  /**
   * Send a text message
   */
  async sendText(
    chatId: string,
    text: string,
    options?: { storeInHistory?: boolean }
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!this.client) {
      return { success: false, error: 'Bot not connected' }
    }

    try {
      const response = await this.client.im.message.create({
        params: {
          receive_id_type: 'chat_id'
        },
        data: {
          receive_id: chatId,
          content: JSON.stringify({ text }),
          msg_type: 'text'
        }
      })

      if (response.data?.message_id) {
        const messageId = response.data.message_id

        // Store in history if requested
        if (options?.storeInHistory !== false) {
          const storedMsg: StoredFeishuMessage = {
            messageId,
            chatId,
            chatType: this.chatTypeMap.get(chatId) || 'p2p',
            fromId: this.botOpenId || 'bot',
            fromName: this.status.botName || 'Bot',
            text,
            date: Math.floor(Date.now() / 1000),
            isFromBot: true
          }
          await feishuStorage.storeMessage(storedMsg)
          appEvents.emitFeishuNewMessage(this.convertToAppMessage(storedMsg))
        }

        return { success: true, messageId }
      }
      return { success: false, error: 'Failed to send message' }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  }

  /**
   * Send a markdown message using interactive card
   * This provides better formatting for Agent responses
   */
  async sendMarkdown(
    chatId: string,
    markdown: string,
    options?: { storeInHistory?: boolean }
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!this.client) {
      return { success: false, error: 'Bot not connected' }
    }

    try {
      // Build card with markdown content
      const card = {
        config: {
          wide_screen_mode: true
        },
        elements: [
          {
            tag: 'markdown',
            content: markdown
          }
        ]
      }

      const response = await this.client.im.message.create({
        params: {
          receive_id_type: 'chat_id'
        },
        data: {
          receive_id: chatId,
          content: JSON.stringify(card),
          msg_type: 'interactive'
        }
      })

      if (response.data?.message_id) {
        const messageId = response.data.message_id

        // Store in history if requested
        if (options?.storeInHistory !== false) {
          const storedMsg: StoredFeishuMessage = {
            messageId,
            chatId,
            chatType: this.chatTypeMap.get(chatId) || 'p2p',
            fromId: this.botOpenId || 'bot',
            fromName: this.status.botName || 'Bot',
            text: markdown,
            date: Math.floor(Date.now() / 1000),
            isFromBot: true
          }
          await feishuStorage.storeMessage(storedMsg)
          appEvents.emitFeishuNewMessage(this.convertToAppMessage(storedMsg))
        }

        return { success: true, messageId }
      }
      return { success: false, error: 'Failed to send markdown message' }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  }

  /**
   * Send an image
   */
  async sendImage(
    chatId: string,
    imagePath: string,
    options?: { storeInHistory?: boolean }
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!this.client) {
      return { success: false, error: 'Bot not connected' }
    }

    try {
      // First upload the image
      console.log(`[Feishu] Uploading image: ${imagePath}`)
      const imageData = await fs.readFile(imagePath)
      console.log(`[Feishu] Image data size: ${imageData.length} bytes`)
      
      const uploadResponse = (await this.client.im.image.create({
        data: {
          image_type: 'message',
          image: imageData
        }
      })) as { image_key?: string; data?: { image_key?: string }; code?: number; msg?: string }
      
      console.log(`[Feishu] Upload response:`, JSON.stringify(uploadResponse, null, 2))

      // Handle both response formats: { image_key: "..." } or { data: { image_key: "..." } }
      const imageKey = uploadResponse?.image_key || uploadResponse?.data?.image_key
      if (!imageKey) {
        const errorMsg = uploadResponse?.msg || 'Failed to upload image (no image_key returned)'
        console.error(`[Feishu] Image upload failed: ${errorMsg}`)
        return { success: false, error: errorMsg }
      }
      console.log(`[Feishu] Image uploaded successfully, image_key: ${imageKey}`)

      // Then send the message
      const response = await this.client.im.message.create({
        params: {
          receive_id_type: 'chat_id'
        },
        data: {
          receive_id: chatId,
          content: JSON.stringify({ image_key: imageKey }),
          msg_type: 'image'
        }
      })

      if (response.data?.message_id) {
        const messageId = response.data.message_id

        if (options?.storeInHistory !== false) {
          const storedMsg: StoredFeishuMessage = {
            messageId,
            chatId,
            chatType: this.chatTypeMap.get(chatId) || 'p2p',
            fromId: this.botOpenId || 'bot',
            fromName: this.status.botName || 'Bot',
            attachments: [
              {
                id: imageKey,
                name: path.basename(imagePath),
                url: imagePath,
                contentType: 'image/png'
              }
            ],
            date: Math.floor(Date.now() / 1000),
            isFromBot: true
          }
          await feishuStorage.storeMessage(storedMsg)
          appEvents.emitFeishuNewMessage(this.convertToAppMessage(storedMsg))
        }

        console.log(`[Feishu] Image sent successfully: ${messageId}`)
        return { success: true, messageId }
      }
      console.error(`[Feishu] Failed to send image message, response:`, JSON.stringify(response, null, 2))
      return { success: false, error: 'Failed to send image' }
    } catch (error) {
      // Log full error details
      console.error(`[Feishu] sendImage error:`, error)
      if (error && typeof error === 'object') {
        const errObj = error as Record<string, unknown>
        if (errObj.code || errObj.msg) {
          console.error(`[Feishu] API error code: ${errObj.code}, msg: ${errObj.msg}`)
        }
      }
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  }

  /**
   * Send a file
   */
  async sendFile(
    chatId: string,
    filePath: string,
    options?: { filename?: string; storeInHistory?: boolean }
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!this.client) {
      return { success: false, error: 'Bot not connected' }
    }

    try {
      const fileName = options?.filename || path.basename(filePath)
      console.log(`[Feishu] Uploading file: ${filePath} as ${fileName}`)
      const fileData = await fs.readFile(filePath)
      console.log(`[Feishu] File data size: ${fileData.length} bytes`)

      // Upload file
      const uploadResponse = (await this.client.im.file.create({
        data: {
          file_type: 'stream',
          file_name: fileName,
          file: fileData
        }
      })) as { file_key?: string; data?: { file_key?: string }; code?: number; msg?: string }
      
      console.log(`[Feishu] File upload response:`, JSON.stringify(uploadResponse, null, 2))

      // Handle both response formats: { file_key: "..." } or { data: { file_key: "..." } }
      const fileKey = uploadResponse?.file_key || uploadResponse?.data?.file_key
      if (!fileKey) {
        const errorMsg = uploadResponse?.msg || 'Failed to upload file (no file_key returned)'
        console.error(`[Feishu] File upload failed: ${errorMsg}`)
        return { success: false, error: errorMsg }
      }
      console.log(`[Feishu] File uploaded successfully, file_key: ${fileKey}`)

      // Send message
      const response = await this.client.im.message.create({
        params: {
          receive_id_type: 'chat_id'
        },
        data: {
          receive_id: chatId,
          content: JSON.stringify({ file_key: fileKey }),
          msg_type: 'file'
        }
      })

      if (response.data?.message_id) {
        const messageId = response.data.message_id

        if (options?.storeInHistory !== false) {
          const storedMsg: StoredFeishuMessage = {
            messageId,
            chatId,
            chatType: this.chatTypeMap.get(chatId) || 'p2p',
            fromId: this.botOpenId || 'bot',
            fromName: this.status.botName || 'Bot',
            attachments: [
              {
                id: fileKey,
                name: fileName,
                url: filePath,
                contentType: this.getMimeType(fileName)
              }
            ],
            date: Math.floor(Date.now() / 1000),
            isFromBot: true
          }
          await feishuStorage.storeMessage(storedMsg)
          appEvents.emitFeishuNewMessage(this.convertToAppMessage(storedMsg))
        }

        console.log(`[Feishu] File sent successfully: ${messageId}`)
        return { success: true, messageId }
      }
      console.error(`[Feishu] Failed to send file message, response:`, JSON.stringify(response, null, 2))
      return { success: false, error: 'Failed to send file' }
    } catch (error) {
      // Log full error details
      console.error(`[Feishu] sendFile error:`, error)
      if (error && typeof error === 'object') {
        const errObj = error as Record<string, unknown>
        if (errObj.code || errObj.msg) {
          console.error(`[Feishu] API error code: ${errObj.code}, msg: ${errObj.msg}`)
        }
      }
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  }

  /**
   * Send a message card (interactive card)
   */
  async sendCard(
    chatId: string,
    card: {
      header?: { title: string; template?: string }
      elements: Array<{ tag: string; content?: string; text?: { tag: string; content: string } }>
    }
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!this.client) {
      return { success: false, error: 'Bot not connected' }
    }

    try {
      const response = await this.client.im.message.create({
        params: {
          receive_id_type: 'chat_id'
        },
        data: {
          receive_id: chatId,
          content: JSON.stringify(card),
          msg_type: 'interactive'
        }
      })

      if (response.data?.message_id) {
        return { success: true, messageId: response.data.message_id }
      }
      return { success: false, error: 'Failed to send card' }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  }
}

// Export singleton instance
export const feishuBotService = new FeishuBotService()
