/**
 * Yumi-specific types for Easemob message storage
 */

// Message type from Easemob
export type YumiMessageType = 'text' | 'image' | 'audio' | 'video' | 'file' | 'custom'

// Attachment stored with message
export interface StoredYumiAttachment {
  id: string
  name: string
  url: string // Remote URL (from Easemob) or local path
  localPath?: string // Local copy in userData for display
  contentType?: string
  size?: number
  width?: number
  height?: number
}

// Stored Yumi message (persisted to disk)
export interface StoredYumiMessage {
  messageId: string
  chatId: string
  senderId: string
  senderName: string
  content: string
  type: YumiMessageType
  timestamp: number // Unix timestamp in milliseconds
  isFromBot: boolean
  attachments?: StoredYumiAttachment[]
  customEvent?: string
  customExts?: Record<string, unknown>
}
