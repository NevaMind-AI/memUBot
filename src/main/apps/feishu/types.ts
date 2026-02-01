/**
 * Feishu-specific types
 */

// Feishu bot configuration
export interface FeishuConfig {
  appId: string
  appSecret: string
}

// Attachment type for stored messages
export interface StoredFeishuAttachment {
  id: string
  name: string
  url: string
  contentType?: string
  size?: number
  width?: number
  height?: number
}

// Stored feishu message (simplified for single-user mode)
export interface StoredFeishuMessage {
  messageId: string
  chatId: string
  chatType: 'p2p' | 'group' // Private chat or group chat
  fromId: string
  fromName?: string
  text?: string
  attachments?: StoredFeishuAttachment[]
  date: number // Unix timestamp in seconds
  replyToMessageId?: string
  isFromBot: boolean
}

// Feishu message event data from SDK
export interface FeishuMessageEvent {
  sender: {
    sender_id: {
      open_id: string
      user_id?: string
      union_id?: string
    }
    sender_type: string
    tenant_key: string
  }
  message: {
    message_id: string
    root_id?: string
    parent_id?: string
    create_time: string
    chat_id: string
    chat_type: 'p2p' | 'group'
    message_type: string
    content: string
    mentions?: Array<{
      key: string
      id: {
        open_id: string
        user_id?: string
        union_id?: string
      }
      name: string
      tenant_key: string
    }>
  }
}

// Feishu user info
export interface FeishuUser {
  openId: string
  userId?: string
  name?: string
  avatarUrl?: string
}
