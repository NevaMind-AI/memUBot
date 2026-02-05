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
  platform: 'telegram' | 'whatsapp' | 'discord' | 'slack' | 'line' | 'feishu'
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
  platform: 'telegram' | 'whatsapp' | 'discord' | 'slack' | 'line' | 'feishu'
  isConnected: boolean
  username?: string
  botName?: string
  avatarUrl?: string
  error?: string
}

// LLM Provider type
type LLMProvider = 'claude' | 'minimax' | 'custom'

// App settings type
interface AppSettings {
  // LLM Provider selection
  llmProvider: LLMProvider
  // Claude settings
  claudeApiKey: string
  claudeModel: string
  // MiniMax settings
  minimaxApiKey: string
  minimaxModel: string
  // Custom provider settings
  customApiKey: string
  customBaseUrl: string
  customModel: string
  // Shared settings
  maxTokens: number
  temperature: number
  systemPrompt: string
  memuBaseUrl: string
  memuApiKey: string
  memuUserId: string
  memuAgentId: string
  telegramBotToken: string
  telegramAutoConnect: boolean
  discordBotToken: string
  discordAutoConnect: boolean
  whatsappEnabled: boolean
  slackBotToken: string
  slackAppToken: string
  slackAutoConnect: boolean
  lineChannelAccessToken: string
  lineChannelSecret: string
  feishuAppId: string
  feishuAppSecret: string
  feishuAutoConnect: boolean
  language: string
  experimentalVisualMode: boolean
  experimentalComputerUse: boolean
  showAgentActivity: boolean
  tavilyApiKey: string
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
  onMessagesRefresh: (callback: () => void) => () => void
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
  onMessagesRefresh: (callback: () => void) => () => void
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
  onMessagesRefresh: (callback: () => void) => () => void
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
  onMessagesRefresh: (callback: () => void) => () => void
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
  onMessagesRefresh: (callback: () => void) => () => void
}

// Feishu API interface (single-user mode)
interface FeishuApi {
  connect: () => Promise<IpcResponse>
  disconnect: () => Promise<IpcResponse>
  getStatus: () => Promise<IpcResponse<BotStatus>>
  getMessages: (limit?: number) => Promise<IpcResponse<AppMessage[]>>
  // Event listeners (returns unsubscribe function)
  onNewMessage: (callback: (message: AppMessage) => void) => () => void
  onStatusChanged: (callback: (status: BotStatus) => void) => () => void
  onMessagesRefresh: (callback: () => void) => () => void
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
  getStorageInfo: () => Promise<IpcResponse<StorageInfo>>
  openMessagesFolder: (platform?: string) => Promise<IpcResponse>
  clearCache: () => Promise<IpcResponse<number>>
  openDevTools: () => Promise<IpcResponse>
  getLogs: () => Promise<IpcResponse<LogsData>>
  clearLogs: () => Promise<IpcResponse>
}

interface LogEntry {
  timestamp: number
  level: 'log' | 'info' | 'warn' | 'error'
  message: string
}

interface LogsData {
  logs: LogEntry[]
  isProduction: boolean
}

// Storage info types
interface StorageFolder {
  name: string
  key: string
  size: number
  color: string
}

interface StorageInfo {
  total: number
  folders: StorageFolder[]
}

// Platform type
type Platform = 'telegram' | 'discord' | 'whatsapp' | 'slack' | 'line' | 'feishu'

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
// - idle: App started but never processed any message
// - thinking: Currently processing, waiting for LLM response
// - tool_executing: Currently executing a tool
// - complete: Last request completed successfully
// - aborted: Last request was aborted/interrupted
type LLMStatus = 'idle' | 'thinking' | 'tool_executing' | 'complete' | 'aborted'

// LLM status info type
interface LLMStatusInfo {
  status: LLMStatus
  currentTool?: string
  iteration?: number
}

// Token usage information
interface TokenUsage {
  estimated?: {
    messages: number
    system: number
    tools: number
    total: number
  }
  actual?: {
    input: number
    output: number
    total: number
  }
}

// Agent activity types
type AgentActivityType = 'thinking' | 'tool_call' | 'tool_result' | 'response'

interface AgentActivityItem {
  id: string
  type: AgentActivityType
  timestamp: number
  iteration?: number
  // Token usage for this step
  tokenUsage?: TokenUsage
  // For thinking
  content?: string
  // For tool_call
  toolName?: string
  toolInput?: Record<string, unknown>
  // For tool_result
  toolUseId?: string
  success?: boolean
  result?: string
  error?: string
  // For response
  message?: string
}

// LLM API interface
interface LLMApi {
  getStatus: () => Promise<LLMStatusInfo>
  abort: () => Promise<{ success: boolean }>
  isProcessing: () => Promise<boolean>
  getActivityLog: () => Promise<AgentActivityItem[]>
  clearActivityLog: () => Promise<{ success: boolean }>
  onStatusChanged: (callback: (status: LLMStatusInfo) => void) => () => void
  onActivityChanged: (callback: (activity: AgentActivityItem) => void) => () => void
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

// Local skill type
interface LocalSkill {
  id: string
  name: string
  description: string
  path: string
  enabled: boolean
  source: 'local' | 'github'
  installedAt?: string
}

// GitHub skill type
interface GitHubSkill {
  name: string
  path: string
  description?: string
  readme?: string
  category?: string
}

// Skills API interface
interface SkillsApi {
  getInstalled: () => Promise<IpcResponse<LocalSkill[]>>
  setEnabled: (skillId: string, enabled: boolean) => Promise<IpcResponse>
  delete: (skillId: string) => Promise<IpcResponse>
  importFromDirectory: () => Promise<IpcResponse<LocalSkill>>
  searchGitHub: (query: string) => Promise<IpcResponse<GitHubSkill[]>>
  installFromGitHub: (skillPath: string) => Promise<IpcResponse<LocalSkill>>
  getContent: (skillId: string) => Promise<IpcResponse<string | null>>
  openDirectory: () => Promise<IpcResponse>
  setGitHubToken: (token: string | undefined) => Promise<IpcResponse>
  getGitHubToken: () => Promise<IpcResponse<string | undefined>>
}

// Service type
type ServiceType = 'longRunning' | 'scheduled'
type ServiceRuntime = 'node' | 'python'
type ServiceStatus = 'stopped' | 'running' | 'error'

// Service info type
interface ServiceInfo {
  id: string
  name: string
  description: string
  type: ServiceType
  runtime: ServiceRuntime
  entryFile: string
  schedule?: string
  createdAt: string
  status: ServiceStatus
  pid?: number
  error?: string
  lastStarted?: string
  lastStopped?: string
  context: {
    userRequest: string
    expectation: string
    notifyPlatform?: string
  }
}

// Services API interface
interface ServicesApi {
  list: () => Promise<IpcResponse<ServiceInfo[]>>
  get: (serviceId: string) => Promise<IpcResponse<ServiceInfo>>
  start: (serviceId: string) => Promise<IpcResponse>
  stop: (serviceId: string) => Promise<IpcResponse>
  delete: (serviceId: string) => Promise<IpcResponse>
  getDir: () => Promise<IpcResponse<string>>
  openDir: () => Promise<IpcResponse>
  onStatusChanged: (callback: (data: { serviceId: string; status: string }) => void) => () => void
  onListChanged: (callback: () => void) => () => void
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
    feishu: FeishuApi
    settings: SettingsApi
    security: SecurityApi
    llm: LLMApi
    startup: StartupApi
    skills: SkillsApi
    services: ServicesApi
  }
}
