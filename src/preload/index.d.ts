import { ElectronAPI } from '@electron-toolkit/preload'

// IPC Response type
interface IpcResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
}

// Conversation message type
interface ConversationMessage {
  role: 'user' | 'assistant'
  content: string
}

// File info type
interface FileInfo {
  name: string
  path: string
  isDirectory: boolean
  size: number
  modifiedAt: Date
  createdAt: Date
}

// App message type
interface AppMessage {
  id: string
  platform: 'telegram' | 'whatsapp' | 'discord'
  chatId: string
  senderId: string
  senderName: string
  content: string
  timestamp: Date
  isFromBot: boolean
  replyToId?: string
}

// Bot status type
interface BotStatus {
  platform: 'telegram' | 'whatsapp' | 'discord'
  isConnected: boolean
  username?: string
  botName?: string
  avatarUrl?: string
  error?: string
}

// Proxy config type
interface ProxyConfig {
  enabled: boolean
  type: 'socks5' | 'http'
  host: string
  port: number
  username?: string
  password?: string
}

// App settings type
interface AppSettings {
  claudeApiKey: string
  claudeModel: string
  maxTokens: number
  temperature: number
  systemPrompt: string
  telegramBotToken: string
  language: string
}

// Agent API interface
interface AgentApi {
  sendMessage: (message: string) => Promise<IpcResponse<string>>
  getHistory: () => Promise<IpcResponse<ConversationMessage[]>>
  clearHistory: () => Promise<IpcResponse>
}

// File API interface
interface FileApi {
  read: (path: string) => Promise<IpcResponse<string>>
  write: (path: string, content: string) => Promise<IpcResponse>
  list: (path: string) => Promise<IpcResponse<FileInfo[]>>
  delete: (path: string) => Promise<IpcResponse>
  exists: (path: string) => Promise<IpcResponse<boolean>>
  info: (path: string) => Promise<IpcResponse<FileInfo>>
}

// Telegram API interface (single-user mode)
interface TelegramApi {
  connect: () => Promise<IpcResponse>
  disconnect: () => Promise<IpcResponse>
  getStatus: () => Promise<IpcResponse<BotStatus>>
  getMessages: (limit?: number) => Promise<IpcResponse<AppMessage[]>>
  // Event listeners (returns unsubscribe function)
  onNewMessage: (callback: (message: AppMessage) => void) => () => void
  onStatusChanged: (callback: (status: BotStatus) => void) => () => void
}

// Proxy API interface
interface ProxyApi {
  getConfig: () => Promise<IpcResponse<ProxyConfig>>
  saveConfig: (config: ProxyConfig) => Promise<IpcResponse>
}

// Settings API interface
interface SettingsApi {
  get: () => Promise<IpcResponse<AppSettings>>
  save: (settings: Partial<AppSettings>) => Promise<IpcResponse>
}

// Tailscale peer type
interface TailscalePeer {
  id: string
  hostname: string
  ipAddress: string
  online: boolean
  os?: string
  lastSeen?: string
}

// Tailscale status type
interface TailscaleStatus {
  installed: boolean
  running: boolean
  loggedIn: boolean
  ipAddress?: string
  hostname?: string
  tailnetName?: string
  peers?: TailscalePeer[]
  error?: string
}

// Tailscale API interface
interface TailscaleApi {
  getStatus: () => Promise<IpcResponse<TailscaleStatus>>
  connect: () => Promise<{ success: boolean; error?: string }>
  disconnect: () => Promise<{ success: boolean; error?: string }>
  login: () => Promise<{ success: boolean; error?: string }>
  logout: () => Promise<{ success: boolean; error?: string }>
  ping: (target: string) => Promise<{ success: boolean; latency?: number; error?: string }>
  onStatusChanged: (callback: (status: TailscaleStatus) => void) => () => void
}

// Bound user type
interface BoundUser {
  userId: number
  username: string
  firstName?: string
  lastName?: string
  boundAt: number
}

// Security code info type
interface SecurityCodeInfo {
  active: boolean
  expiresAt?: number
  remainingSeconds?: number
}

// Security API interface
interface SecurityApi {
  generateCode: () => Promise<IpcResponse<{ code: string }>>
  getCodeInfo: () => Promise<IpcResponse<SecurityCodeInfo>>
  getBoundUsers: () => Promise<IpcResponse<BoundUser[]>>
  removeBoundUser: (userId: number) => Promise<IpcResponse<{ removed: boolean }>>
  clearBoundUsers: () => Promise<IpcResponse>
}

// LLM status type
type LLMStatus = 'idle' | 'thinking' | 'tool_executing'

// LLM status info type
interface LLMStatusInfo {
  status: LLMStatus
  currentTool?: string
  iteration?: number
}

// LLM API interface
interface LLMApi {
  getStatus: () => Promise<LLMStatusInfo>
  abort: () => Promise<{ success: boolean }>
  isProcessing: () => Promise<boolean>
  onStatusChanged: (callback: (status: LLMStatusInfo) => void) => () => void
}

declare global {
  interface Window {
    electron: ElectronAPI
    agent: AgentApi
    file: FileApi
    telegram: TelegramApi
    proxy: ProxyApi
    settings: SettingsApi
    tailscale: TailscaleApi
    security: SecurityApi
    llm: LLMApi
  }
}
