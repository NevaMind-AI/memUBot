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

export type EasemobEventType =
  | 'connected'
  | 'disconnected'
  | 'reconnecting'
  | 'message'
  | 'error'

export interface EasemobEventHandlers {
  onConnected?: () => void
  onDisconnected?: () => void
  onReconnecting?: () => void
  onMessage?: (message: EasemobMessage) => void
  onError?: (error: Error) => void
}
