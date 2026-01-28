/**
 * Slack-specific types
 */

// Attachment type for stored messages
export interface StoredAttachment {
  id: string
  name: string
  url: string
  mimetype?: string
  size?: number
}

// Stored message format
export interface StoredSlackMessage {
  messageId: string // ts (timestamp) in Slack
  channelId: string
  threadTs?: string // Thread timestamp for threaded messages
  fromId: string
  fromUsername: string
  fromDisplayName?: string
  text?: string
  attachments?: StoredAttachment[]
  date: number // Unix timestamp in seconds
  replyToMessageId?: string
  isFromBot: boolean
}

// Slack channel info
export interface SlackChannel {
  id: string
  name: string
  isPrivate: boolean
  isIm: boolean
  isMpim: boolean
}

// Slack user info
export interface SlackUser {
  id: string
  name: string
  realName?: string
  displayName?: string
  isBot: boolean
}

// Slack workspace info
export interface SlackWorkspace {
  id: string
  name: string
  domain: string
}
