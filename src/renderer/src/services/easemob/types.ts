/**
 * Easemob IM Service Types
 *
 * Only used in Yumi mode for instant messaging.
 */

export interface EasemobConfig {
  appKey: string
}

export interface EasemobUser {
  id: string
  nickname?: string
  avatarUrl?: string
}

export interface EasemobMessage {
  id: string
  type: 'text' | 'image' | 'audio' | 'video' | 'file' | 'custom'
  from: string
  to: string
  content: string
  timestamp: number
  // For image/audio/video/file messages
  fileUrl?: string
  filename?: string
  fileSize?: number
  width?: number
  height?: number
  thumb?: string // thumbnail URL for images
  secret?: string // download key
  // For custom messages
  customEvent?: string
  customExts?: Record<string, unknown>
}

export interface EasemobConnectionState {
  connected: boolean
  userId?: string
  error?: string
}

/**
 * Reason for being kicked offline
 */
export type KickReason =
  | 'other_device_login' // Another device logged in with the same account
  | 'user_removed' // User account was disabled/removed
  | 'password_changed' // Password was changed
  | 'token_expired' // Token expired
  | 'kicked_by_admin' // Kicked by admin from console
  | 'device_limit_exceeded' // Too many devices logged in
  | 'unknown' // Unknown reason

/**
 * Kick offline event info
 */
export interface KickOfflineInfo {
  reason: KickReason
  message: string
  rawType: number
}

export type EasemobEventType =
  | 'connected'
  | 'disconnected'
  | 'reconnecting'
  | 'message'
  | 'error'
  | 'kicked'
  | 'token_will_expire'
  | 'token_expired'

export interface EasemobEventHandlers {
  onConnected?: () => void
  onDisconnected?: () => void
  onReconnecting?: () => void
  onMessage?: (message: EasemobMessage) => void
  onError?: (error: Error) => void
  onKicked?: (info: KickOfflineInfo) => void
  onTokenWillExpire?: () => void
  onTokenExpired?: () => void
}
