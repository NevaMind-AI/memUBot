/**
 * WhatsApp-specific types
 */

// Attachment type for stored messages
export interface StoredAttachment {
  id: string
  name: string
  url?: string
  mimetype?: string
  data?: string // Base64 encoded for local storage
  size: number
}

// Stored message format
export interface StoredWhatsAppMessage {
  messageId: string
  chatId: string
  fromId: string
  fromName: string
  fromPushName?: string
  text?: string
  attachments?: StoredAttachment[]
  date: number // Unix timestamp in seconds
  replyToMessageId?: string
  isFromBot: boolean
}

// WhatsApp chat info
export interface WhatsAppChat {
  id: string
  name: string
  isGroup: boolean
}

// WhatsApp connection status
export interface WhatsAppConnectionStatus {
  state: 'disconnected' | 'connecting' | 'qr_ready' | 'connected' | 'authenticated'
  qrCode?: string
}
