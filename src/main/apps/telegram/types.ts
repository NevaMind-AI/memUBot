import type TelegramBot from 'node-telegram-bot-api'

/**
 * Telegram-specific types
 */

// Telegram bot configuration
export interface TelegramConfig {
  token: string
  polling?: boolean
}

// Telegram message from API
export type TelegramMessage = TelegramBot.Message

// Telegram chat from API
export type TelegramChat = TelegramBot.Chat

// Telegram user from API
export type TelegramUser = TelegramBot.User

// Attachment type for stored messages
export interface StoredTelegramAttachment {
  id: string
  name: string
  url: string
  contentType?: string
  size?: number
  width?: number
  height?: number
}

// Stored telegram message (simplified for single-user mode)
export interface StoredTelegramMessage {
  messageId: number
  chatId: number
  fromId?: number
  fromUsername?: string
  fromFirstName?: string
  text?: string
  attachments?: StoredTelegramAttachment[]
  date: number
  replyToMessageId?: number
  isFromBot: boolean
}
