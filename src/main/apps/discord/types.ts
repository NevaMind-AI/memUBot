/**
 * Discord-specific types
 */

// Attachment type for stored messages
export interface StoredAttachment {
  id: string
  name: string
  url: string
  proxyURL?: string
  contentType?: string
  size: number
  width?: number
  height?: number
}

// Stored message format
export interface StoredDiscordMessage {
  messageId: string
  channelId: string
  guildId?: string
  fromId: string
  fromUsername: string
  fromDisplayName?: string
  text?: string
  attachments?: StoredAttachment[]
  date: number // Unix timestamp in seconds
  replyToMessageId?: string
  isFromBot: boolean
}

// Discord message from API
export interface DiscordMessage {
  id: string
  channelId: string
  guildId?: string | null
  author: {
    id: string
    username: string
    displayName?: string
    bot?: boolean
  }
  content: string
  createdTimestamp: number
  reference?: {
    messageId?: string
  } | null
}
