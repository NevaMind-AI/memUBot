/**
 * Common types for all app implementations
 */

// Supported app platforms
export type AppPlatform = 'telegram' | 'whatsapp' | 'discord'

// Base message structure
export interface AppMessage {
  id: string
  platform: AppPlatform
  chatId: string
  senderId: string
  senderName: string
  content: string
  timestamp: Date
  isFromBot: boolean
  replyToId?: string
  metadata?: Record<string, unknown>
}

// Proxy configuration
export interface ProxyConfig {
  enabled: boolean
  type: 'socks5' | 'http'
  host: string
  port: number
  username?: string
  password?: string
}

// Bot status
export interface BotStatus {
  platform: AppPlatform
  isConnected: boolean
  username?: string
  botName?: string
  avatarUrl?: string
  error?: string
}

// App service interface (single-user mode)
export interface IAppService {
  platform: AppPlatform
  connect(): Promise<void>
  disconnect(): Promise<void>
  getStatus(): BotStatus
  getMessages(limit?: number): Promise<AppMessage[]>
}
