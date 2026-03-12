/**
 * WhatsApp Types
 * Type definitions for WhatsApp bot service
 */

export interface WhatsAppMessage {
  id: string
  from: string
  to: string
  body: string
  timestamp: number
  fromMe: boolean
  hasMedia?: boolean
  mediaUrl?: string
  mediaType?: string
}

export interface StoredWhatsAppMessage extends WhatsAppMessage {
  id: string
  from: string
  to: string
  body: string
  timestamp: number
  fromMe: boolean
  hasMedia?: boolean
  mediaUrl?: string
  mediaType?: string
}

export interface WhatsAppConnectionStatus {
  state: 'disconnected' | 'connecting' | 'connected' | 'qr'
  qrCode?: string
  error?: string
}

export interface WhatsAppChat {
  id: string
  name: string
  isGroup: boolean
  unreadCount: number
  lastMessage?: WhatsAppMessage
}

export interface WhatsAppContact {
  id: string
  name: string
  number: string
  isMe: boolean
}
