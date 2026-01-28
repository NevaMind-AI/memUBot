/**
 * Line-specific types
 */

// Attachment type for stored messages
export interface StoredAttachment {
  id: string
  name: string
  url?: string
  contentType?: string
  size?: number
}

// Stored message format
export interface StoredLineMessage {
  messageId: string
  replyToken?: string
  sourceType: 'user' | 'group' | 'room'
  sourceId: string // userId, groupId, or roomId
  userId: string
  userName?: string
  text?: string
  attachments?: StoredAttachment[]
  date: number // Unix timestamp in seconds (milliseconds from Line API / 1000)
  replyToMessageId?: string
  isFromBot: boolean
}

// Line message types
export type LineMessageType =
  | 'text'
  | 'image'
  | 'video'
  | 'audio'
  | 'file'
  | 'location'
  | 'sticker'

// Line user profile
export interface LineUserProfile {
  userId: string
  displayName: string
  pictureUrl?: string
  statusMessage?: string
}

// Line group/room info
export interface LineGroupInfo {
  groupId: string
  groupName?: string
  pictureUrl?: string
}
