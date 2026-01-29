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

// Message attachment type
interface MessageAttachment {
  id: string
  name: string
  url: string
  contentType?: string
  size: number
  width?: number
  height?: number
}

// App message type
interface AppMessage {
  id: string
  platform: 'telegram' | 'whatsapp' | 'discord' | 'slack' | 'line'
  chatId?: string
  senderId?: string
  senderName: string
  content: string
  attachments?: MessageAttachment[]
  timestamp: Date
  isFromBot: boolean
  replyToId?: string
}

// Bot status type
interface BotStatus {
  platform: 'telegram' | 'whatsapp' | 'discord' | 'slack' | 'line'
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
  discordBotToken: string
  whatsappEnabled: boolean
  slackBotToken: string
  slackAppToken: string
  lineChannelAccessToken: string
  lineChannelSecret: string
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

// Discord API interface (single-user mode)
interface DiscordApi {
  connect: () => Promise<IpcResponse>
  disconnect: () => Promise<IpcResponse>
  getStatus: () => Promise<IpcResponse<BotStatus>>
  getMessages: (limit?: number) => Promise<IpcResponse<AppMessage[]>>
  // Event listeners (returns unsubscribe function)
  onNewMessage: (callback: (message: AppMessage) => void) => () => void
  onStatusChanged: (callback: (status: BotStatus) => void) => () => void
}

// WhatsApp API interface (single-user mode)
interface WhatsAppApi {
  connect: () => Promise<IpcResponse>
  disconnect: () => Promise<IpcResponse>
  getStatus: () => Promise<IpcResponse<BotStatus>>
  getQRCode: () => Promise<IpcResponse<string | undefined>>
  getMessages: (limit?: number) => Promise<IpcResponse<AppMessage[]>>
  // Event listeners (returns unsubscribe function)
  onNewMessage: (callback: (message: AppMessage) => void) => () => void
  onStatusChanged: (callback: (status: BotStatus) => void) => () => void
}

// Slack API interface (single-user mode)
interface SlackApi {
  connect: () => Promise<IpcResponse>
  disconnect: () => Promise<IpcResponse>
  getStatus: () => Promise<IpcResponse<BotStatus>>
  getMessages: (limit?: number) => Promise<IpcResponse<AppMessage[]>>
  // Event listeners (returns unsubscribe function)
  onNewMessage: (callback: (message: AppMessage) => void) => () => void
  onStatusChanged: (callback: (status: BotStatus) => void) => () => void
}

// Line API interface (single-user mode)
interface LineApi {
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

// MCP Server Configuration
interface McpServerConfig {
  [key: string]: {
    command: string
    args?: string[]
    env?: Record<string, string>
    disabled?: boolean
  }
}

// MCP Server Status
interface McpServerStatus {
  name: string
  toolCount: number
  connected: boolean
}

// Settings API interface
interface SettingsApi {
  get: () => Promise<IpcResponse<AppSettings>>
  save: (settings: Partial<AppSettings>) => Promise<IpcResponse>
  getMcpConfig: () => Promise<IpcResponse<McpServerConfig>>
  saveMcpConfig: (config: McpServerConfig) => Promise<IpcResponse>
  getMcpStatus: () => Promise<IpcResponse<McpServerStatus[]>>
  reloadMcp: () => Promise<IpcResponse>
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

// Platform type
type Platform = 'telegram' | 'discord' | 'whatsapp' | 'slack' | 'line'

// Bound user type
interface BoundUser {
  platform: Platform
  uniqueId: string
  userId: number
  username: string
  firstName?: string
  lastName?: string
  avatarUrl?: string
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
  getBoundUsers: (platform?: Platform) => Promise<IpcResponse<BoundUser[]>>
  removeBoundUser: (userId: number, platform?: Platform) => Promise<IpcResponse<{ removed: boolean }>>
  removeBoundUserById: (uniqueId: string, platform: Platform) => Promise<IpcResponse<{ removed: boolean }>>
  clearBoundUsers: (platform?: Platform) => Promise<IpcResponse>
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

// Startup status type
interface StartupStatus {
  stage: 'initializing' | 'mcp' | 'platforms' | 'ready'
  message: string
  progress: number
}

// Startup API interface
interface StartupApi {
  getStatus: () => Promise<{ ready: boolean }>
  onStatusChanged: (callback: (status: StartupStatus) => void) => () => void
}

declare global {
  interface Window {
    electron: ElectronAPI
    agent: AgentApi
    file: FileApi
    telegram: TelegramApi
    discord: DiscordApi
    whatsapp: WhatsAppApi
    slack: SlackApi
    line: LineApi
    proxy: ProxyApi
    settings: SettingsApi
    tailscale: TailscaleApi
    security: SecurityApi
    llm: LLMApi
    startup: StartupApi
  }
}
