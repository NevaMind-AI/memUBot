/**
 * Easemob auto-connection manager
 *
 * Owns the connection lifecycle based on auth state.
 * Only active in Yumi mode.
 *
 * Architecture:
 * - This is the SINGLE owner of connection callbacks (onConnected/onDisconnected)
 * - Updates easemobStore for reactive UI state
 * - Forwards incoming Easemob messages to main process for storage via IPC
 * - Listens for send requests from main process (yumi:send-message) and sends via SDK
 * - Components receive messages through the standard window.yumi.onNewMessage()
 */

import { easemobService } from './index'
import { setEasemobStatus } from '../../stores/easemobStore'
import type { EasemobMessage, KickOfflineInfo } from './types'

let initialized = false

// Current auth info for determining isFromBot
let currentAgentId: string | null = null

// Stored connect function for manual reconnect
let connectFn: ((easemob: { agentId: string; userId: string; token: string } | null) => Promise<void>) | null = null

/**
 * Download a file from URL and return as byte array
 */
async function downloadFileAsBuffer(url: string): Promise<{ buffer: number[]; size: number } | null> {
  try {
    console.log('[EasemobAuto] Downloading file:', url.substring(0, 80) + '...')
    const response = await fetch(url)
    if (!response.ok) {
      console.error('[EasemobAuto] Download failed:', response.status, response.statusText)
      return null
    }
    const arrayBuffer = await response.arrayBuffer()
    const buffer = Array.from(new Uint8Array(arrayBuffer))
    console.log('[EasemobAuto] Downloaded file:', buffer.length, 'bytes')
    return { buffer, size: buffer.length }
  } catch (error) {
    console.error('[EasemobAuto] Download error:', error)
    return null
  }
}

/**
 * Detect MIME type from filename extension
 */
function getMimeType(filename: string): string {
  const ext = filename.toLowerCase().split('.').pop() || ''
  const mimeTypes: Record<string, string> = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
    gif: 'image/gif', webp: 'image/webp', bmp: 'image/bmp',
    mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', amr: 'audio/amr',
    mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime',
    pdf: 'application/pdf', doc: 'application/msword', txt: 'text/plain',
    zip: 'application/zip'
  }
  return mimeTypes[ext] || 'application/octet-stream'
}

/**
 * Forward an Easemob message to main process for storage.
 * For image/file/audio/video messages, downloads the file first, then sends buffer to main.
 * Main process will persist it and broadcast via yumi:new-message event.
 */
async function forwardMessageToMain(msg: EasemobMessage): Promise<void> {
  const isFromBot = msg.from === currentAgentId
  const hasAttachment = ['image', 'audio', 'video', 'file'].includes(msg.type) && msg.fileUrl

  let attachment: {
    url: string
    filename: string
    mimeType?: string
    size?: number
    width?: number
    height?: number
    thumb?: string
    buffer?: number[]
  } | undefined

  if (hasAttachment && msg.fileUrl) {
    // Download the file in renderer (has Easemob SDK auth context)
    const downloaded = await downloadFileAsBuffer(msg.fileUrl)

    // Determine filename - ensure it has a proper extension based on message type
    let filename = msg.filename || 'file'
    let mimeType = getMimeType(filename)

    // If MIME type couldn't be detected from filename, infer from message type
    if (mimeType === 'application/octet-stream') {
      const typeMimeMap: Record<string, string> = {
        image: 'image/jpeg',
        audio: 'audio/mpeg',
        video: 'video/mp4'
      }
      if (typeMimeMap[msg.type]) {
        mimeType = typeMimeMap[msg.type]
      }
    }

    // Ensure filename has proper extension for images/audio/video
    const hasExtension = filename.includes('.') && filename.split('.').pop()!.length <= 5
    if (!hasExtension) {
      const typeExtMap: Record<string, string> = {
        image: '.jpg',
        audio: '.mp3',
        video: '.mp4'
      }
      if (typeExtMap[msg.type]) {
        filename = filename + typeExtMap[msg.type]
      }
    }

    attachment = {
      url: msg.fileUrl,
      filename,
      mimeType,
      size: downloaded?.size || msg.fileSize,
      width: msg.width,
      height: msg.height,
      thumb: msg.thumb,
      buffer: downloaded?.buffer
    }
  }

  window.yumi.storeMessage({
    messageId: msg.id,
    chatId: msg.to === currentAgentId ? msg.from : msg.to, // chat partner id
    senderId: msg.from,
    senderName: isFromBot ? 'Yumi' : msg.from,
    content: hasAttachment ? `[${msg.type === 'image' ? 'Image' : 'File'}: ${msg.filename || 'file'}]` : msg.content,
    type: msg.type,
    timestamp: msg.timestamp,
    isFromBot,
    attachment,
    customEvent: msg.customEvent,
    customExts: msg.customExts
  })
}

/**
 * Notify main process of connection status change
 */
function notifyConnectionStatus(isConnected: boolean, error?: string): void {
  window.yumi.updateConnectionStatus(isConnected, error)
}

/**
 * Get user-friendly message for kick reason
 */
function getKickReasonMessage(reason: string): string {
  switch (reason) {
    case 'other_device_login':
      return 'Your account has been logged in on another device.'
    case 'user_removed':
      return 'Your account has been disabled or removed.'
    case 'password_changed':
      return 'Your password has been changed. Please re-login.'
    case 'token_expired':
      return 'Your session has expired. Please re-login.'
    case 'kicked_by_admin':
      return 'You have been logged out by an administrator.'
    case 'device_limit_exceeded':
      return 'Maximum number of devices exceeded.'
    default:
      return 'You have been disconnected.'
  }
}

/**
 * Setup listener for send message requests from main process
 */
function setupSendMessageListener(): void {
  window.yumi.onSendMessage(async (request) => {
    console.log('[EasemobAuto] Send message request:', request.type, request.targetUserId)

    let result: { success: boolean; messageId?: string; remoteUrl?: string; error?: string }

    switch (request.type) {
      case 'text':
        result = await easemobService.sendTextMessage(request.targetUserId, request.content || '')
        break

      case 'image':
        if (request.buffer) {
          // Local file - convert buffer to Blob and send
          const uint8Array = new Uint8Array(request.buffer)
          const blob = new Blob([uint8Array], { type: request.mimeType || 'image/jpeg' })
          const file = new File([blob], request.filename || 'image.jpg', {
            type: request.mimeType || 'image/jpeg'
          })
          result = await easemobService.sendImageFile(request.targetUserId, file, {
            filename: request.filename,
            width: request.width,
            height: request.height
          })
        } else if (request.content) {
          // Remote URL
          result = await easemobService.sendImageMessage(request.targetUserId, request.content, {
            filename: request.filename,
            width: request.width,
            height: request.height
          })
        } else {
          result = { success: false, error: 'No content or buffer provided for image' }
        }
        break

      case 'file':
        if (request.buffer) {
          // Local file - convert buffer to Blob and send
          const uint8Array = new Uint8Array(request.buffer)
          const blob = new Blob([uint8Array], { type: request.mimeType || 'application/octet-stream' })
          const file = new File([blob], request.filename || 'file', {
            type: request.mimeType || 'application/octet-stream'
          })
          result = await easemobService.sendFileFile(request.targetUserId, file, request.filename || 'file', {
            fileSize: request.fileSize
          })
        } else if (request.content) {
          // Remote URL
          result = await easemobService.sendFileMessage(
            request.targetUserId,
            request.content,
            request.filename || 'file',
            { fileSize: request.fileSize }
          )
        } else {
          result = { success: false, error: 'No content or buffer provided for file' }
        }
        break

      default:
        result = { success: false, error: `Unsupported message type: ${request.type}` }
    }

    // Send response back to main process
    if (request.responseChannel) {
      window.electron.ipcRenderer.send(request.responseChannel, result)
    }
  })
}

export function initEasemobAutoConnect(): void {
  if (initialized) return
  initialized = true

  const appMode = import.meta.env.VITE_APP_MODE || 'memu'
  if (appMode !== 'yumi') {
    return
  }

  const appKey = import.meta.env.VITE_EASEMOB_APP_KEY || ''
  if (!appKey) {
    console.warn('[EasemobAuto] VITE_EASEMOB_APP_KEY not configured')
    return
  }

  console.log('[EasemobAuto] Initializing auto-connect')

  // Register connection lifecycle callbacks (single owner)
  easemobService.setConnectionCallbacks({
    onConnected: () => {
      setEasemobStatus({ connected: true, connecting: false, error: null, kickReason: null })
      notifyConnectionStatus(true)
    },
    onDisconnected: () => {
      setEasemobStatus({ connected: false, connecting: false })
      notifyConnectionStatus(false)
    },
    onReconnecting: () => {
      setEasemobStatus({ connecting: true })
    },
    onError: (error) => {
      setEasemobStatus({ connected: false, connecting: false, error: error.message })
      notifyConnectionStatus(false, error.message)
    },
    onKicked: async (info: KickOfflineInfo) => {
      console.warn('[EasemobAuto] Kicked offline:', info.reason)
      const errorMessage = getKickReasonMessage(info.reason)
      setEasemobStatus({
        connected: false,
        connecting: false,
        error: errorMessage,
        kickReason: info.reason
      })
      notifyConnectionStatus(false, errorMessage)

      // Sign out from Firebase for security reasons
      // All kick reasons require re-authentication
      console.log('[EasemobAuto] Signing out from Firebase due to kick:', info.reason)
      try {
        await window.auth.signOut()
      } catch (error) {
        console.error('[EasemobAuto] Failed to sign out from Firebase:', error)
      }
    },
    onTokenWillExpire: () => {
      // Token is set to long-term, so this shouldn't happen normally
      // Log as warning for monitoring
      console.warn('[EasemobAuto] Token will expire soon - unexpected for long-term token')
    },
    onTokenExpired: async () => {
      // Token expiration is treated as abnormal (tokens are set to long-term)
      // Sign out from Firebase and require re-login
      console.warn('[EasemobAuto] Token expired - treating as abnormal, signing out')
      setEasemobStatus({
        connected: false,
        connecting: false,
        error: 'Session expired. Please re-login.',
        kickReason: 'token_expired'
      })
      notifyConnectionStatus(false, 'Token expired')

      // Sign out from Firebase
      try {
        await window.auth.signOut()
      } catch (error) {
        console.error('[EasemobAuto] Failed to sign out from Firebase:', error)
      }
    }
  })

  // Register global message listener that forwards to main process
  easemobService.onMessage((msg) => {
    forwardMessageToMain(msg)
  })

  // Setup listener for send requests from main process
  setupSendMessageListener()

  connectFn = async (easemob: { agentId: string; userId: string; token: string } | null) => {
    if (!easemob?.agentId || !easemob.userId || !easemob.token) {
      currentAgentId = null
      if (easemobService.isConnected()) {
        await easemobService.logout()
      }
      setEasemobStatus({ connected: false, connecting: false, error: null })
      notifyConnectionStatus(false)
      return
    }

    // Track current agentId for isFromBot determination
    currentAgentId = easemob.agentId

    if (!easemobService.isConnected()) {
      console.log('[EasemobAuto] Connecting as:', easemob.agentId)
      setEasemobStatus({ connecting: true, error: null })
      easemobService.initialize({ appKey })
      const result = await easemobService.login(easemob.agentId, easemob.token)
      if (!result.success) {
        console.error('[EasemobAuto] Login failed:', result.error)
        setEasemobStatus({ connected: false, connecting: false, error: result.error || 'Login failed' })
        notifyConnectionStatus(false, result.error || 'Login failed')
      }
    }
  }

  // Check initial state
  window.auth.getState()
    .then((state) => connectFn!(state.easemob))
    .catch((error) => console.error('[EasemobAuto] Failed to get auth state:', error))

  // React to auth changes
  window.auth.onStateChanged((state) => {
    connectFn!(state.easemob)
  })
}

/**
 * Manually reconnect Easemob IM
 * Disconnects first if connected, then reconnects using current auth state
 */
export async function reconnectEasemob(): Promise<void> {
  if (!connectFn) {
    console.warn('[EasemobAuto] Not initialized, cannot reconnect')
    return
  }

  console.log('[EasemobAuto] Manual reconnect requested')

  // Disconnect first if currently connected
  if (easemobService.isConnected()) {
    setEasemobStatus({ connecting: true, error: null })
    await easemobService.logout()
  }

  // Re-fetch auth state and connect
  try {
    const state = await window.auth.getState()
    await connectFn(state.easemob)
  } catch (error) {
    console.error('[EasemobAuto] Reconnect failed:', error)
    setEasemobStatus({ connected: false, connecting: false, error: 'Reconnect failed' })
  }
}
