/**
 * Easemob IM Service
 *
 * Provides instant messaging functionality for Yumi mode.
 * Uses Easemob Web SDK (easemob-websdk).
 *
 * Architecture:
 * - EasemobService is a singleton managing the SDK connection
 * - autoConnect (separate module) manages lifecycle based on auth state
 * - easemobStore (zustand) holds reactive UI state
 * - Components subscribe to store for status, and register message listeners here
 */

import EC from 'easemob-websdk'
import type {
  EasemobConfig,
  EasemobMessage,
  EasemobConnectionState,
  KickOfflineInfo,
  KickReason
} from './types'

// Re-export types
export * from './types'
export * from './autoConnect'

// Message listener type
type MessageListener = (message: EasemobMessage) => void

class EasemobService {
  private client: EC.connection | null = null
  private connectionState: EasemobConnectionState = { connected: false }
  private currentUserId: string | null = null
  private appKey: string | null = null

  // Connection lifecycle callbacks (set by autoConnect, single owner)
  private onConnectedCallback: (() => void) | null = null
  private onDisconnectedCallback: (() => void) | null = null
  private onReconnectingCallback: (() => void) | null = null
  private onErrorCallback: ((error: Error) => void) | null = null
  private onKickedCallback: ((info: KickOfflineInfo) => void) | null = null
  private onTokenWillExpireCallback: (() => void) | null = null
  private onTokenExpiredCallback: (() => void) | null = null

  // Message listeners (multiple subscribers allowed)
  private messageListeners: Set<MessageListener> = new Set()

  /**
   * Initialize the Easemob SDK
   */
  initialize(config: EasemobConfig): void {
    // If already initialized with same appKey, skip
    if (this.client && this.appKey === config.appKey) {
      return
    }

    // If initialized with different appKey, destroy first
    if (this.client) {
      this.destroy()
    }

    console.log('[Easemob] Initializing with appKey:', config.appKey)
    this.appKey = config.appKey

    // Create Easemob connection instance
    this.client = new EC.connection({
      appKey: config.appKey
    })

    // Set up SDK event listeners
    this.setupEventListeners()
  }

  /**
   * Set connection lifecycle callbacks (single owner - autoConnect)
   */
  setConnectionCallbacks(callbacks: {
    onConnected?: () => void
    onDisconnected?: () => void
    onReconnecting?: () => void
    onError?: (error: Error) => void
    onKicked?: (info: KickOfflineInfo) => void
    onTokenWillExpire?: () => void
    onTokenExpired?: () => void
  }): void {
    this.onConnectedCallback = callbacks.onConnected || null
    this.onDisconnectedCallback = callbacks.onDisconnected || null
    this.onReconnectingCallback = callbacks.onReconnecting || null
    this.onErrorCallback = callbacks.onError || null
    this.onKickedCallback = callbacks.onKicked || null
    this.onTokenWillExpireCallback = callbacks.onTokenWillExpire || null
    this.onTokenExpiredCallback = callbacks.onTokenExpired || null
  }

  /**
   * Subscribe to incoming messages (multiple subscribers allowed)
   * Returns unsubscribe function
   */
  onMessage(listener: MessageListener): () => void {
    this.messageListeners.add(listener)
    return () => {
      this.messageListeners.delete(listener)
    }
  }

  /**
   * Map raw kick type to KickReason
   */
  private mapKickReason(type: number): KickReason {
    switch (type) {
      case 1:
        return 'other_device_login'
      case 2:
        return 'user_removed'
      case 3:
        return 'password_changed'
      case 4:
        return 'token_expired'
      case 206:
        return 'device_limit_exceeded'
      case 207:
        return 'kicked_by_admin'
      default:
        return 'unknown'
    }
  }

  /**
   * Set up SDK event listeners
   */
  private setupEventListeners(): void {
    if (!this.client) return

    // Connection events
    this.client.addEventHandler('connection', {
      onConnected: () => {
        console.log('[Easemob] Connected')
        this.connectionState = { connected: true, userId: this.currentUserId || undefined }
        this.onConnectedCallback?.()
      },
      onDisconnected: () => {
        console.log('[Easemob] Disconnected')
        this.connectionState = { connected: false }
        this.onDisconnectedCallback?.()
      },
      onReconnecting: () => {
        console.log('[Easemob] Reconnecting...')
        this.onReconnectingCallback?.()
      },
      onError: (error: { message: string }) => {
        console.error('[Easemob] Error:', error)
        this.connectionState = { ...this.connectionState, error: error.message }
        this.onErrorCallback?.(new Error(error.message))
      },
      // Kicked offline by another device or admin
      onOffline: (info: { type: number; message: string }) => {
        const reason = this.mapKickReason(info.type)
        console.warn('[Easemob] Kicked offline:', { reason, rawType: info.type, message: info.message })
        this.connectionState = { connected: false, error: `Kicked: ${reason}` }
        this.onKickedCallback?.({
          reason,
          message: info.message,
          rawType: info.type
        })
      },
      // Token will expire soon (can refresh proactively)
      onTokenWillExpire: () => {
        console.log('[Easemob] Token will expire soon')
        this.onTokenWillExpireCallback?.()
      },
      // Token has expired
      onTokenExpired: () => {
        console.warn('[Easemob] Token expired')
        this.connectionState = { connected: false, error: 'Token expired' }
        this.onTokenExpiredCallback?.()
      }
    })

    // Message events
    this.client.addEventHandler('message', {
      onTextMessage: (message: EC.TextMsgBody) => {
        this.handleMessage('text', message)
      },
      onImageMessage: (message: EC.ImgMsgBody) => {
        this.handleMessage('image', message)
      },
      onAudioMessage: (message: EC.AudioMsgBody) => {
        this.handleMessage('audio', message)
      },
      onVideoMessage: (message: EC.VideoMsgBody) => {
        this.handleMessage('video', message)
      },
      onFileMessage: (message: EC.FileMsgBody) => {
        this.handleMessage('file', message)
      },
      onCustomMessage: (message: EC.CustomMsgBody) => {
        this.handleMessage('custom', message)
      }
    })
  }

  /**
   * Handle incoming messages and dispatch to all listeners
   */
  private handleMessage(
    type: EasemobMessage['type'],
    message: EC.TextMsgBody | EC.ImgMsgBody | EC.AudioMsgBody | EC.VideoMsgBody | EC.FileMsgBody | EC.CustomMsgBody
  ): void {
    let content = ''
    let customEvent: string | undefined
    let customExts: Record<string, unknown> | undefined
    let fileUrl: string | undefined
    let filename: string | undefined
    let fileSize: number | undefined
    let width: number | undefined
    let height: number | undefined
    let thumb: string | undefined
    let secret: string | undefined

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const msg = message as any

    if (type === 'text' && 'msg' in message) {
      content = message.msg as string
    } else if (type === 'image') {
      fileUrl = msg.url || msg.body?.url
      filename = msg.filename || msg.body?.filename || msg.file?.filename || 'image'
      width = msg.width
      height = msg.height
      thumb = msg.thumb
      secret = msg.secret
      content = fileUrl || ''
    } else if (type === 'audio') {
      fileUrl = msg.url || msg.body?.url
      filename = msg.filename || msg.body?.filename || 'audio'
      fileSize = msg.file_length || msg.length
      secret = msg.secret
      content = fileUrl || ''
    } else if (type === 'video') {
      fileUrl = msg.url || msg.body?.url
      filename = msg.filename || msg.body?.filename || 'video'
      fileSize = msg.file_length
      width = msg.width
      height = msg.height
      thumb = msg.thumb
      secret = msg.secret
      content = fileUrl || ''
    } else if (type === 'file') {
      fileUrl = msg.url || msg.body?.url
      filename = msg.filename || msg.body?.filename || msg.file?.filename || 'file'
      fileSize = msg.file_length
      secret = msg.secret
      content = fileUrl || ''
    } else if (type === 'custom' && 'customEvent' in message) {
      customEvent = message.customEvent as string
      customExts = message.customExts as Record<string, unknown>
      content = JSON.stringify(customExts)
    }

    const easemobMessage: EasemobMessage = {
      id: message.id,
      type,
      from: message.from,
      to: message.to,
      content,
      timestamp: message.time,
      fileUrl,
      filename,
      fileSize,
      width,
      height,
      thumb,
      secret,
      customEvent,
      customExts
    }

    console.log('[Easemob] Received message:', easemobMessage.type, 'from:', easemobMessage.from,
      fileUrl ? `url: ${fileUrl.substring(0, 80)}...` : '')
    this.messageListeners.forEach((listener) => listener(easemobMessage))
  }

  /**
   * Login with user ID and token
   */
  async login(userId: string, token: string): Promise<{ success: boolean; error?: string }> {
    if (!this.client) {
      return { success: false, error: 'Easemob not initialized' }
    }

    try {
      console.log('[Easemob] Logging in as:', userId, 'token:', `${token.substring(0, 8)}...`)
      this.currentUserId = userId

      await this.client.open({
        user: userId,
        accessToken: token
      })

      return { success: true }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Login failed'
      console.error('[Easemob] Login failed:', errorMessage)
      return { success: false, error: errorMessage }
    }
  }

  /**
   * Logout and disconnect
   */
  async logout(): Promise<void> {
    if (!this.client) return

    try {
      console.log('[Easemob] Logging out')
      await this.client.close()
      this.currentUserId = null
      this.connectionState = { connected: false }
    } catch (error) {
      console.error('[Easemob] Logout error:', error)
    }
  }

  /**
   * Send a text message
   */
  async sendTextMessage(
    to: string,
    content: string,
    chatType: 'singleChat' | 'groupChat' = 'singleChat'
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!this.client || !this.connectionState.connected) {
      return { success: false, error: 'Not connected' }
    }

    try {
      const message = EC.message.create({
        type: 'txt',
        chatType,
        to,
        msg: content
      })

      const result = await this.client.send(message)
      console.log('[Easemob] Message sent:', result)
      return { success: true, messageId: result.serverMsgId }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Send failed'
      console.error('[Easemob] Send message failed:', errorMessage)
      return { success: false, error: errorMessage }
    }
  }

  /**
   * Send an image message via URL
   * @param to Target user ID
   * @param url Image URL (must be accessible via HTTP/HTTPS)
   */
  async sendImageMessage(
    to: string,
    url: string,
    options?: {
      filename?: string
      width?: number
      height?: number
      chatType?: 'singleChat' | 'groupChat'
    }
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!this.client || !this.connectionState.connected) {
      return { success: false, error: 'Not connected' }
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const message = EC.message.create({
        type: 'img',
        chatType: options?.chatType || 'singleChat',
        to,
        url,
        ...(options?.filename && { filename: options.filename }),
        ...(options?.width && { width: options.width }),
        ...(options?.height && { height: options.height })
      } as any)

      const result = await this.client.send(message)
      console.log('[Easemob] Image message sent:', result)
      return { success: true, messageId: result.serverMsgId }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Send failed'
      console.error('[Easemob] Send image message failed:', errorMessage)
      return { success: false, error: errorMessage }
    }
  }

  /**
   * Send an image message via File object (local file upload)
   * SDK will upload the file to Easemob server
   * @param to Target user ID
   * @param file File object to upload
   */
  async sendImageFile(
    to: string,
    file: File,
    options?: {
      filename?: string
      width?: number
      height?: number
      chatType?: 'singleChat' | 'groupChat'
    }
  ): Promise<{ success: boolean; messageId?: string; remoteUrl?: string; error?: string }> {
    if (!this.client || !this.connectionState.connected) {
      return { success: false, error: 'Not connected' }
    }

    try {
      console.log('[Easemob] Sending image file:', file.name, file.size, file.type)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const message = EC.message.create({
        type: 'img',
        chatType: options?.chatType || 'singleChat',
        to,
        file: {
          data: file,
          filename: options?.filename || file.name,
          filetype: file.type || 'image/jpeg'
        },
        ...(options?.width && { width: options.width }),
        ...(options?.height && { height: options.height }),
        onFileUploadProgress: (progress: { loaded: number; total: number }) => {
          console.log('[Easemob] Image upload progress:', Math.round((progress.loaded / progress.total) * 100) + '%')
        }
      } as any)

      const result = await this.client.send(message)
      console.log('[Easemob] Image file sent:', result)

      // Extract the uploaded URL from the result if available
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const remoteUrl = (result as any).url || (message as any).url

      return { success: true, messageId: result.serverMsgId, remoteUrl }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Send failed'
      console.error('[Easemob] Send image file failed:', errorMessage, error)
      return { success: false, error: errorMessage }
    }
  }

  /**
   * Send a file message via URL
   * @param to Target user ID
   * @param url File URL (must be accessible via HTTP/HTTPS)
   * @param filename Filename to display
   */
  async sendFileMessage(
    to: string,
    url: string,
    filename: string,
    options?: {
      fileSize?: number
      chatType?: 'singleChat' | 'groupChat'
    }
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!this.client || !this.connectionState.connected) {
      return { success: false, error: 'Not connected' }
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const message = EC.message.create({
        type: 'file',
        chatType: options?.chatType || 'singleChat',
        to,
        url,
        filename,
        ...(options?.fileSize && { file_length: options.fileSize })
      } as any)

      const result = await this.client.send(message)
      console.log('[Easemob] File message sent:', result)
      return { success: true, messageId: result.serverMsgId }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Send failed'
      console.error('[Easemob] Send file message failed:', errorMessage)
      return { success: false, error: errorMessage }
    }
  }

  /**
   * Send a file message via File object (local file upload)
   * SDK will upload the file to Easemob server
   * @param to Target user ID
   * @param file File object to upload
   * @param filename Display filename
   */
  async sendFileFile(
    to: string,
    file: File,
    filename: string,
    options?: {
      fileSize?: number
      chatType?: 'singleChat' | 'groupChat'
    }
  ): Promise<{ success: boolean; messageId?: string; remoteUrl?: string; error?: string }> {
    if (!this.client || !this.connectionState.connected) {
      return { success: false, error: 'Not connected' }
    }

    try {
      console.log('[Easemob] Sending file:', filename, file.size, file.type)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const message = EC.message.create({
        type: 'file',
        chatType: options?.chatType || 'singleChat',
        to,
        file: {
          data: file,
          filename: filename,
          filetype: file.type || 'application/octet-stream'
        },
        ...(options?.fileSize && { file_length: options.fileSize }),
        onFileUploadProgress: (progress: { loaded: number; total: number }) => {
          console.log('[Easemob] File upload progress:', Math.round((progress.loaded / progress.total) * 100) + '%')
        }
      } as any)

      const result = await this.client.send(message)
      console.log('[Easemob] File sent:', result)

      // Extract the uploaded URL from the result if available
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const remoteUrl = (result as any).url || (message as any).url

      return { success: true, messageId: result.serverMsgId, remoteUrl }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Send failed'
      console.error('[Easemob] Send file failed:', errorMessage, error)
      return { success: false, error: errorMessage }
    }
  }

  /**
   * Get connection state
   */
  getConnectionState(): EasemobConnectionState {
    return this.connectionState
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connectionState.connected
  }

  /**
   * Destroy the service
   */
  destroy(): void {
    if (this.client) {
      this.client.close()
      this.client = null
    }
    this.appKey = null
    this.connectionState = { connected: false }
    this.currentUserId = null
    this.messageListeners.clear()
    this.onConnectedCallback = null
    this.onDisconnectedCallback = null
    this.onReconnectingCallback = null
    this.onErrorCallback = null
    this.onKickedCallback = null
    this.onTokenWillExpireCallback = null
    this.onTokenExpiredCallback = null
  }
}

// Singleton instance
export const easemobService = new EasemobService()
