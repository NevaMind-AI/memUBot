/**
 * YumiBotService - Manages Yumi's IM connection and message handling
 *
 * Unlike other platforms where the SDK runs in main process,
 * Yumi uses Easemob SDK in the renderer process. This service:
 * - Tracks connection status (synced from renderer via IPC)
 * - Processes incoming messages with agentService
 * - Sends replies via IPC to renderer (which uses Easemob SDK to send)
 *
 * Message Flow:
 * 1. Renderer Easemob SDK receives message
 * 2. renderer -> main: yumi:store-message (stores & broadcasts)
 * 3. main: YumiBotService.processIncomingMessage() -> agentService
 * 4. main -> renderer: yumi:send-message (renderer sends via Easemob)
 */

import { BrowserWindow, app } from 'electron'
import * as fs from 'fs/promises'
import * as path from 'path'
import { yumiStorage } from './storage'
import { agentService } from '../../services/agent.service'
import { infraService } from '../../services/infra.service'
import { appEvents } from '../../events'
import type { BotStatus, AppMessage } from '../types'
import type { StoredYumiMessage, StoredYumiAttachment } from './types'

// Input types for sendImage/sendFile
export interface SendImageBufferInput {
  type: 'buffer'
  buffer: Buffer
  filename: string
  mimeType?: string
  size?: number
  width?: number
  height?: number
}

export interface SendImageUrlInput {
  type: 'url'
  url: string
  filename?: string
  width?: number
  height?: number
}

export type SendImageInput = SendImageBufferInput | SendImageUrlInput

export interface SendFileBufferInput {
  type: 'buffer'
  buffer: Buffer
  filename: string
  mimeType?: string
  size?: number
}

export interface SendFileUrlInput {
  type: 'url'
  url: string
  filename: string
  size?: number
}

export type SendFileInput = SendFileBufferInput | SendFileUrlInput

export class YumiBotService {
  private status: BotStatus = {
    platform: 'yumi',
    isConnected: false
  }

  // Current target user ID for sending replies
  private currentTargetUserId: string | null = null

  // Deduplication: track processed message IDs to avoid duplicate processing
  private processedMessageIds: Set<string> = new Set()
  private readonly MAX_PROCESSED_IDS = 1000

  // Processing queue: serialize message handling to prevent concurrent Agent calls
  private isProcessingMessage = false
  private messageQueue: Array<{ message: StoredYumiMessage; attachmentData?: Parameters<YumiBotService['processIncomingMessage']>[1] }> = []

  /**
   * Initialize the service (called on app startup)
   */
  async initialize(): Promise<void> {
    await yumiStorage.initialize()
    console.log('[Yumi] Service initialized')
  }

  /**
   * Update connection status (called from renderer via IPC)
   */
  updateConnectionStatus(isConnected: boolean, error?: string): void {
    this.status = {
      platform: 'yumi',
      isConnected,
      error
    }
    appEvents.emitYumiStatusChanged(this.status)
    console.log('[Yumi] Connection status updated:', isConnected, error || '')
  }

  /**
   * Get bot status
   */
  getStatus(): BotStatus {
    return this.status
  }

  /**
   * Get messages from storage
   */
  async getMessages(limit = 200): Promise<AppMessage[]> {
    const messages = await yumiStorage.getMessages(limit)
    return messages.map((msg) => this.convertToAppMessage(msg))
  }

  /**
   * Process an incoming message from Easemob (via renderer IPC)
   * Stores the message, processes with agent, and sends reply
   *
   * Messages are queued and processed sequentially to prevent concurrent Agent calls.
   *
   * @param message The message data
   * @param attachmentData Optional attachment data (buffer from renderer download)
   */
  async processIncomingMessage(
    message: StoredYumiMessage,
    attachmentData?: {
      url: string
      filename: string
      mimeType?: string
      size?: number
      width?: number
      height?: number
      thumb?: string
      buffer?: number[]
    }
  ): Promise<void> {
    // Deduplication: skip if already processed
    if (this.processedMessageIds.has(message.messageId)) {
      console.log(`[Yumi] Skipping duplicate message: ${message.messageId}`)
      return
    }
    this.processedMessageIds.add(message.messageId)

    // Cleanup old IDs if set is too large
    if (this.processedMessageIds.size > this.MAX_PROCESSED_IDS) {
      const idsArray = Array.from(this.processedMessageIds)
      for (let i = 0; i < this.MAX_PROCESSED_IDS / 2; i++) {
        this.processedMessageIds.delete(idsArray[i])
      }
    }

    console.log('[Yumi] ========== MESSAGE RECEIVED ==========')
    console.log('[Yumi] Message ID:', message.messageId)
    console.log('[Yumi] From:', message.senderId)
    console.log('[Yumi] Type:', message.type)
    console.log('[Yumi] Content:', message.content?.substring(0, 100))
    console.log('[Yumi] Is From Bot:', message.isFromBot)
    console.log('[Yumi] Has Attachment:', !!attachmentData)
    console.log('[Yumi] =======================================')

    // If there's attachment data, save the file locally and add attachment to message
    if (attachmentData) {
      try {
        const attachment = await this.saveIncomingAttachment(message.messageId, attachmentData)
        if (attachment) {
          message.attachments = [attachment]
          console.log('[Yumi] Attachment saved locally:', attachment.localPath)
        }
      } catch (error) {
        console.error('[Yumi] Failed to save attachment:', error)
      }
    }

    // Store the message (with attachments)
    await yumiStorage.storeMessage(message)

    // Emit event for UI
    const appMessage = this.convertToAppMessage(message)
    appEvents.emitYumiNewMessage(appMessage)

    // Skip Agent processing if message is from bot (avoid loops)
    if (message.isFromBot) {
      console.log('[Yumi] Skipping bot message')
      return
    }

    // Queue message for sequential Agent processing
    this.messageQueue.push({ message, attachmentData })
    await this.processNextInQueue()
  }

  /**
   * Process the next message in queue (sequential processing)
   * Prevents concurrent Agent calls from the same platform
   */
  private async processNextInQueue(): Promise<void> {
    if (this.isProcessingMessage || this.messageQueue.length === 0) {
      return
    }

    this.isProcessingMessage = true
    const item = this.messageQueue.shift()!
    const { message } = item

    try {
      // Track the sender as target for replies
      this.currentTargetUserId = message.senderId

      // Collect image local paths for multimodal processing
      const imageUrls: string[] = []
      if (message.attachments) {
        for (const att of message.attachments) {
          if (att.contentType?.startsWith('image/') && att.localPath) {
            imageUrls.push(att.localPath)
          }
        }
      }

      // Build text content - include file path info for Agent (like other platforms)
      let textContent = message.content || ''
      if (message.attachments && message.attachments.length > 0) {
        const filePaths = message.attachments
          .filter(att => att.localPath)
          .map(att => `- ${att.name} (${att.contentType || 'unknown'}): ${att.localPath}`)
        if (filePaths.length > 0) {
          const fileInfo = filePaths.join('\n')
          if (textContent && !textContent.startsWith('[Image:') && !textContent.startsWith('[File:')) {
            textContent = `${textContent}\n\n[Attached files - use file_read tool to read content]:\n${fileInfo}`
          } else {
            textContent = `[Attached files - use file_read tool to read content]:\n${fileInfo}`
          }
        }
      }

      // Publish incoming message event to infraService
      infraService.publish('message:incoming', {
        platform: 'yumi',
        timestamp: message.timestamp,
        message: { role: 'user', content: textContent },
        metadata: {
          userId: message.senderId,
          chatId: message.chatId,
          messageId: message.messageId,
          imageUrls
        }
      })

      // Process with Agent and reply - include images if present
      if (textContent || imageUrls.length > 0) {
        await this.processWithAgentAndReply(message.senderId, textContent, imageUrls)
      }
    } catch (error) {
      console.error('[Yumi] Error processing queued message:', error)
    } finally {
      this.isProcessingMessage = false
      // Process next message in queue if any
      if (this.messageQueue.length > 0) {
        await this.processNextInQueue()
      }
    }
  }

  /**
   * Detect MIME type and extension from file magic bytes (header)
   */
  private detectFileType(buffer: Buffer): { mimeType: string; ext: string } | null {
    if (buffer.length < 4) return null

    // JPEG: FF D8 FF
    if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
      return { mimeType: 'image/jpeg', ext: '.jpg' }
    }
    // PNG: 89 50 4E 47
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
      return { mimeType: 'image/png', ext: '.png' }
    }
    // GIF: 47 49 46 38
    if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38) {
      return { mimeType: 'image/gif', ext: '.gif' }
    }
    // WebP: 52 49 46 46 ... 57 45 42 50
    if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
        buffer.length > 11 && buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) {
      return { mimeType: 'image/webp', ext: '.webp' }
    }
    // BMP: 42 4D
    if (buffer[0] === 0x42 && buffer[1] === 0x4D) {
      return { mimeType: 'image/bmp', ext: '.bmp' }
    }
    // PDF: 25 50 44 46
    if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
      return { mimeType: 'application/pdf', ext: '.pdf' }
    }
    // MP4: ... 66 74 79 70 (ftyp at offset 4)
    if (buffer.length > 7 && buffer[4] === 0x66 && buffer[5] === 0x74 && buffer[6] === 0x79 && buffer[7] === 0x70) {
      return { mimeType: 'video/mp4', ext: '.mp4' }
    }
    // MP3: FF FB or FF F3 or FF F2 or ID3
    if ((buffer[0] === 0xFF && (buffer[1] === 0xFB || buffer[1] === 0xF3 || buffer[1] === 0xF2)) ||
        (buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33)) {
      return { mimeType: 'audio/mpeg', ext: '.mp3' }
    }
    // OGG: 4F 67 67 53
    if (buffer[0] === 0x4F && buffer[1] === 0x67 && buffer[2] === 0x67 && buffer[3] === 0x53) {
      return { mimeType: 'audio/ogg', ext: '.ogg' }
    }
    // WAV: 52 49 46 46 ... 57 41 56 45
    if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
        buffer.length > 11 && buffer[8] === 0x57 && buffer[9] === 0x41 && buffer[10] === 0x56 && buffer[11] === 0x45) {
      return { mimeType: 'audio/wav', ext: '.wav' }
    }
    // AMR: 23 21 41 4D 52
    if (buffer.length > 4 && buffer[0] === 0x23 && buffer[1] === 0x21 && buffer[2] === 0x41 && buffer[3] === 0x4D && buffer[4] === 0x52) {
      return { mimeType: 'audio/amr', ext: '.amr' }
    }
    // ZIP/DOCX/XLSX: 50 4B 03 04
    if (buffer[0] === 0x50 && buffer[1] === 0x4B && buffer[2] === 0x03 && buffer[3] === 0x04) {
      return { mimeType: 'application/zip', ext: '.zip' }
    }

    return null
  }

  /**
   * Ensure filename has a proper extension, adding one based on detected type if needed
   */
  private ensureFilenameExtension(filename: string, detectedExt: string): string {
    const hasExt = filename.includes('.') && (filename.split('.').pop()?.length || 0) <= 5
    if (hasExt) return filename
    return filename + detectedExt
  }

  /**
   * Save an incoming attachment to local storage
   * Downloads from buffer (already downloaded by renderer) or saves directly
   */
  private async saveIncomingAttachment(
    messageId: string,
    data: {
      url: string
      filename: string
      mimeType?: string
      size?: number
      width?: number
      height?: number
      thumb?: string
      buffer?: number[]
    }
  ): Promise<StoredYumiAttachment | null> {
    const attachmentsDir = path.join(app.getPath('userData'), 'yumi-attachments')
    await fs.mkdir(attachmentsDir, { recursive: true })

    let buffer: Buffer | null = null
    let detectedMimeType = data.mimeType || 'application/octet-stream'
    let filename = data.filename

    if (data.buffer && data.buffer.length > 0) {
      buffer = Buffer.from(data.buffer)
    } else {
      // No buffer - try to download from URL in main process as fallback
      try {
        const response = await fetch(data.url)
        if (response.ok) {
          const arrayBuffer = await response.arrayBuffer()
          buffer = Buffer.from(arrayBuffer)
          console.log('[Yumi] Downloaded attachment:', buffer.length, 'bytes')
        } else {
          console.error('[Yumi] Failed to download attachment:', response.status)
          return {
            id: messageId,
            name: data.filename,
            url: data.url,
            contentType: data.mimeType,
            size: data.size,
            width: data.width,
            height: data.height
          }
        }
      } catch (error) {
        console.error('[Yumi] Failed to download attachment:', error)
        return {
          id: messageId,
          name: data.filename,
          url: data.url,
          contentType: data.mimeType,
          size: data.size,
          width: data.width,
          height: data.height
        }
      }
    }

    // Detect real file type from magic bytes
    if (buffer) {
      const detected = this.detectFileType(buffer)
      if (detected) {
        detectedMimeType = detected.mimeType
        filename = this.ensureFilenameExtension(filename, detected.ext)
        console.log('[Yumi] Detected file type:', detected.mimeType, 'filename:', filename)
      }
    }

    // Save to disk
    const uniqueFilename = `${Date.now()}-${filename}`
    const localPath = path.join(attachmentsDir, uniqueFilename)

    if (buffer) {
      await fs.writeFile(localPath, buffer)
      console.log('[Yumi] Saved attachment to:', localPath, `(${buffer.length} bytes)`)
    }

    return {
      id: messageId,
      name: filename,
      url: data.url,
      localPath,
      contentType: detectedMimeType,
      size: buffer?.length || data.size,
      width: data.width,
      height: data.height
    }
  }

  /**
   * Process message with Agent and send reply
   */
  private async processWithAgentAndReply(targetUserId: string, userMessage: string, imageUrls: string[] = []): Promise<void> {
    console.log('[Yumi] Sending to Agent:', userMessage.substring(0, 100),
      imageUrls.length > 0 ? `with ${imageUrls.length} images` : '')

    try {
      // Check if message should be consumed by other services
      if (await infraService.tryConsumeUserInput(userMessage, 'yumi')) {
        console.log('[Yumi] Message consumed by another service')
        return
      }

      // Get response from Agent - pass image URLs for multimodal processing
      const response = await agentService.processMessage(userMessage, 'yumi', imageUrls)

      // Check if rejected due to cross-platform lock
      if (!response.success && response.busyWith) {
        const platformNames: Record<string, string> = {
          telegram: 'Telegram',
          discord: 'Discord',
          slack: 'Slack',
          whatsapp: 'WhatsApp',
          line: 'Line',
          yumi: 'Yumi'
        }
        const busyPlatformName = platformNames[response.busyWith] || response.busyWith
        console.log(`[Yumi] Agent is busy with ${response.busyWith}`)
        await this.sendText(targetUserId, `⏳ I'm currently processing a message from ${busyPlatformName}. Please wait a moment.`)
        return
      }

      if (response.success) {
        // Agent may have already sent message via yumi_send_text tool
        // Only send additional message if there's content in the final response
        if (response.message) {
          console.log('[Yumi] Agent response:', response.message.substring(0, 100) + '...')
          await this.sendText(targetUserId, response.message)
        } else {
          console.log('[Yumi] Agent completed (message sent via tool)')
        }
      } else {
        console.error('[Yumi] Agent error:', response.error)
        await this.sendText(targetUserId, `Error: ${response.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('[Yumi] Error processing with Agent:', error)
      await this.sendText(targetUserId, 'Sorry, something went wrong.')
    }
  }

  /**
   * Send a text message via Easemob (through renderer IPC)
   */
  async sendText(
    targetUserId: string,
    text: string,
    options?: { storeInHistory?: boolean }
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!this.status.isConnected) {
      return { success: false, error: 'Not connected' }
    }

    try {
      // Send to renderer via IPC
      const result = await this.sendToRenderer('yumi:send-message', {
        targetUserId,
        content: text,
        type: 'text'
      })

      if (!result.success) {
        return { success: false, error: result.error }
      }

      // Store message in history (default: true)
      const shouldStore = options?.storeInHistory !== false
      if (shouldStore && result.messageId) {
        const storedMsg: StoredYumiMessage = {
          messageId: result.messageId,
          chatId: targetUserId,
          senderId: 'yumi', // Bot's ID
          senderName: 'Yumi',
          content: text,
          type: 'text',
          timestamp: Date.now(),
          isFromBot: true
        }
        await yumiStorage.storeMessage(storedMsg)

        // Emit event for UI
        const appMessage = this.convertToAppMessage(storedMsg)
        appEvents.emitYumiNewMessage(appMessage)

        // Publish outgoing message event
        infraService.publish('message:outgoing', {
          platform: 'yumi',
          timestamp: storedMsg.timestamp,
          content: text,
          metadata: { messageId: result.messageId }
        })
      }

      return { success: true, messageId: result.messageId }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  }

  /**
   * Send an image message via Easemob (through renderer IPC)
   * Supports both local file (buffer) and remote URL
   */
  async sendImage(
    targetUserId: string,
    input: SendImageInput,
    options?: { storeInHistory?: boolean }
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!this.status.isConnected) {
      return { success: false, error: 'Not connected' }
    }

    try {
      let sendData: {
        targetUserId: string
        type: 'image'
        content?: string
        buffer?: number[] // Array of bytes for IPC transfer
        filename?: string
        mimeType?: string
        width?: number
        height?: number
      }

      let localPath: string | undefined
      let remoteUrl: string | undefined
      const filename = input.type === 'buffer' ? input.filename : (input.filename || 'image')

      if (input.type === 'buffer') {
        // Local file - save to private directory and send buffer
        const attachmentsDir = path.join(app.getPath('userData'), 'yumi-attachments')
        await fs.mkdir(attachmentsDir, { recursive: true })

        const uniqueFilename = `${Date.now()}-${filename}`
        localPath = path.join(attachmentsDir, uniqueFilename)
        await fs.writeFile(localPath, input.buffer)

        // Convert buffer to array for IPC transfer
        sendData = {
          targetUserId,
          type: 'image',
          buffer: Array.from(input.buffer),
          filename,
          mimeType: input.mimeType || 'image/jpeg',
          width: input.width,
          height: input.height
        }
      } else {
        // Remote URL - pass through
        remoteUrl = input.url
        sendData = {
          targetUserId,
          type: 'image',
          content: input.url,
          filename,
          width: input.width,
          height: input.height
        }
      }

      // Send to renderer via IPC
      const result = await this.sendToRenderer('yumi:send-message', sendData)

      if (!result.success) {
        return { success: false, error: result.error }
      }

      // Store message in history (default: true)
      const shouldStore = options?.storeInHistory !== false
      if (shouldStore && result.messageId) {
        const attachment: StoredYumiAttachment = {
          id: result.messageId,
          name: filename,
          url: result.remoteUrl || remoteUrl || '',
          localPath,
          contentType: input.type === 'buffer' ? input.mimeType : 'image/jpeg',
          size: input.type === 'buffer' ? input.size : undefined,
          width: input.width,
          height: input.height
        }

        const storedMsg: StoredYumiMessage = {
          messageId: result.messageId,
          chatId: targetUserId,
          senderId: 'yumi',
          senderName: 'Yumi',
          content: `[Image: ${filename}]`,
          type: 'image',
          timestamp: Date.now(),
          isFromBot: true,
          attachments: [attachment]
        }
        await yumiStorage.storeMessage(storedMsg)

        // Emit event for UI
        const appMessage = this.convertToAppMessage(storedMsg)
        appEvents.emitYumiNewMessage(appMessage)

        // Publish outgoing message event
        infraService.publish('message:outgoing', {
          platform: 'yumi',
          timestamp: storedMsg.timestamp,
          content: `[Image: ${filename}]`,
          metadata: { messageId: result.messageId, type: 'image' }
        })
      }

      return { success: true, messageId: result.messageId }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  }

  /**
   * Send a file message via Easemob (through renderer IPC)
   * Supports both local file (buffer) and remote URL
   */
  async sendFile(
    targetUserId: string,
    input: SendFileInput,
    options?: { storeInHistory?: boolean }
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!this.status.isConnected) {
      return { success: false, error: 'Not connected' }
    }

    try {
      let sendData: {
        targetUserId: string
        type: 'file'
        content?: string
        buffer?: number[] // Array of bytes for IPC transfer
        filename: string
        mimeType?: string
        fileSize?: number
      }

      let localPath: string | undefined
      let remoteUrl: string | undefined
      const filename = input.filename

      if (input.type === 'buffer') {
        // Local file - save to private directory and send buffer
        const attachmentsDir = path.join(app.getPath('userData'), 'yumi-attachments')
        await fs.mkdir(attachmentsDir, { recursive: true })

        const uniqueFilename = `${Date.now()}-${filename}`
        localPath = path.join(attachmentsDir, uniqueFilename)
        await fs.writeFile(localPath, input.buffer)

        // Convert buffer to array for IPC transfer
        sendData = {
          targetUserId,
          type: 'file',
          buffer: Array.from(input.buffer),
          filename,
          mimeType: input.mimeType || 'application/octet-stream',
          fileSize: input.size
        }
      } else {
        // Remote URL - pass through
        remoteUrl = input.url
        sendData = {
          targetUserId,
          type: 'file',
          content: input.url,
          filename,
          fileSize: input.size
        }
      }

      // Send to renderer via IPC
      const result = await this.sendToRenderer('yumi:send-message', sendData)

      if (!result.success) {
        return { success: false, error: result.error }
      }

      // Store message in history (default: true)
      const shouldStore = options?.storeInHistory !== false
      if (shouldStore && result.messageId) {
        const attachment: StoredYumiAttachment = {
          id: result.messageId,
          name: filename,
          url: result.remoteUrl || remoteUrl || '',
          localPath,
          contentType: input.type === 'buffer' ? input.mimeType : 'application/octet-stream',
          size: input.size
        }

        const storedMsg: StoredYumiMessage = {
          messageId: result.messageId,
          chatId: targetUserId,
          senderId: 'yumi',
          senderName: 'Yumi',
          content: `[File: ${filename}]`,
          type: 'file',
          timestamp: Date.now(),
          isFromBot: true,
          attachments: [attachment]
        }
        await yumiStorage.storeMessage(storedMsg)

        // Emit event for UI
        const appMessage = this.convertToAppMessage(storedMsg)
        appEvents.emitYumiNewMessage(appMessage)

        // Publish outgoing message event
        infraService.publish('message:outgoing', {
          platform: 'yumi',
          timestamp: storedMsg.timestamp,
          content: `[File: ${filename}]`,
          metadata: { messageId: result.messageId, type: 'file', filename }
        })
      }

      return { success: true, messageId: result.messageId }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  }

  /**
   * Send IPC message to renderer and wait for response
   */
  private async sendToRenderer(
    channel: string,
    data: unknown
  ): Promise<{ success: boolean; messageId?: string; remoteUrl?: string; error?: string }> {
    return new Promise((resolve) => {
      const windows = BrowserWindow.getAllWindows()
      if (windows.length === 0) {
        resolve({ success: false, error: 'No window available' })
        return
      }

      const win = windows[0]
      if (win.isDestroyed()) {
        resolve({ success: false, error: 'Window is destroyed' })
        return
      }

      // Send message and wait for response
      const responseChannel = `${channel}:response:${Date.now()}`
      const { ipcMain } = require('electron')

      const timeout = setTimeout(() => {
        ipcMain.removeAllListeners(responseChannel)
        resolve({ success: false, error: 'Timeout waiting for response' })
      }, 30000)

      ipcMain.once(responseChannel, (_event: unknown, response: { success: boolean; messageId?: string; remoteUrl?: string; error?: string }) => {
        clearTimeout(timeout)
        resolve(response)
      })

      win.webContents.send(channel, { ...data as object, responseChannel })
    })
  }

  /**
   * Get current target user ID
   */
  getCurrentTargetUserId(): string | null {
    return this.currentTargetUserId
  }

  /**
   * Convert stored message to AppMessage
   */
  private convertToAppMessage(msg: StoredYumiMessage): AppMessage {
    // Convert attachments if present
    let attachments: AppMessage['attachments']
    if (msg.attachments && msg.attachments.length > 0) {
      attachments = msg.attachments.map((att) => ({
        id: att.id,
        name: att.name,
        // Prefer local path for display (use local-file:// protocol), fallback to remote URL
        // local-file:// is a custom Electron protocol registered in main/index.ts
        url: att.localPath ? `local-file://${att.localPath}` : att.url,
        contentType: att.contentType,
        size: att.size || 0,
        width: att.width,
        height: att.height
      }))
    }

    return {
      id: msg.messageId,
      platform: 'yumi',
      chatId: msg.chatId,
      senderId: msg.senderId,
      senderName: msg.senderName,
      content: msg.content,
      attachments,
      timestamp: new Date(msg.timestamp),
      isFromBot: msg.isFromBot
    }
  }
}

// Export singleton instance
export const yumiBotService = new YumiBotService()
