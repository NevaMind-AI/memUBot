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
  platform: 'telegram' | 'whatsapp' | 'discord' | 'slack' | 'line' | 'feishu' | 'yumi'
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
  platform: 'telegram' | 'whatsapp' | 'discord' | 'slack' | 'line' | 'feishu' | 'yumi'
  isConnected: boolean
  username?: string
  botName?: string
  avatarUrl?: string
  error?: string
}

// LLM Provider type
type LLMProvider = 'claude' | 'minimax' | 'zenmux' | 'custom'

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
  // Zenmux settings
  zenmuxApiKey: string
  zenmuxModel: string
  // Custom provider settings
  customApiKey: string
  customBaseUrl: string
  customModel: string
  // Shared settings
  maxTokens: number
  temperature: number
  systemPrompt: string
  modelTier: 'agile' | 'smart' | 'deep'
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

// Auth types (Yumi only - Firebase authentication)
interface AuthUserInfo {
  uid: string
  email: string | null
  displayName: string | null
  photoURL: string | null
}

interface AuthCredentials {
  accessToken: string
  refreshToken: string
  expiresAt: number
}

interface EasemobAuthInfo {
  agentId: string
  userId: string
  token: string
}

interface AuthState {
  isLoggedIn: boolean
  user: AuthUserInfo | null
  credentials: AuthCredentials | null
  easemob: EasemobAuthInfo | null
  memuApiKey: string | null
}

interface AuthLoginResult {
  success: boolean
  user?: AuthUserInfo
  easemob?: EasemobAuthInfo
  error?: string
}

interface AuthLogoutResult {
  success: boolean
  error?: string
}

// Yumi message type (chatId and senderId are always present for Easemob messages)
interface YumiMessage extends Omit<AppMessage, 'chatId' | 'senderId'> {
  chatId: string
  senderId: string
}

// Attachment data sent from renderer to main for downloading/storing
interface YumiAttachmentIpc {
  url: string // Remote URL to download
  filename: string
  mimeType?: string
  size?: number
  width?: number
  height?: number
  thumb?: string // Thumbnail URL
  buffer?: number[] // Already-downloaded file data as byte array
}

// Stored Yumi message (sent from renderer to main for persistence)
interface StoredYumiMessageIpc {
  messageId: string
  chatId: string
  senderId: string
  senderName: string
  content: string
  type: 'text' | 'image' | 'audio' | 'video' | 'file' | 'custom'
  timestamp: number
  isFromBot: boolean
  // Attachment data for image/file/audio/video messages
  attachment?: YumiAttachmentIpc
  customEvent?: string
  customExts?: Record<string, unknown>
}

// Yumi send message request from main process
interface YumiSendMessageRequest {
  targetUserId: string
  type: 'text' | 'image' | 'file'
  // Content for text messages or URL for image/file messages
  content?: string
  // Buffer data (array of bytes) for local files
  buffer?: number[]
  // For image/file messages
  filename?: string
  mimeType?: string
  width?: number
  height?: number
  // For file messages
  fileSize?: number
  // IPC response channel
  responseChannel?: string
}

// User-initiated message params (sent via backend IM API)
interface SendUserMessageParams {
  type: 'txt' | 'img' | 'file'
  content?: string        // text content (for txt type)
  buffer?: number[]       // file data as byte array (for img/file type)
  filename?: string       // original filename (for img/file type)
  mimeType?: string       // MIME type (for img/file type)
  width?: number          // image width (for img type)
  height?: number         // image height (for img type)
  fileSize?: number       // file size (for file type)
}

// Yumi API interface (standard IPC, same pattern as other platforms)
interface YumiApi {
  // Message retrieval
  getMessages: (limit?: number) => Promise<IpcResponse<YumiMessage[]>>
  getStatus: () => Promise<IpcResponse<BotStatus>>

  // Forward incoming messages to main for storage and agent processing
  storeMessage: (message: StoredYumiMessageIpc) => Promise<IpcResponse>

  // Notify main process of connection status changes
  updateConnectionStatus: (isConnected: boolean, error?: string) => Promise<IpcResponse>

  // Event listeners (from main process)
  onNewMessage: (callback: (message: YumiMessage) => void) => () => void
  onStatusChanged: (callback: (status: BotStatus) => void) => () => void
  onMessagesRefresh: (callback: () => void) => () => void

  // Listen for send message requests from main process
  onSendMessage: (callback: (request: YumiSendMessageRequest) => void) => () => void

  // Send a user-initiated message via backend IM API
  sendUserMessage: (params: SendUserMessageParams) => Promise<IpcResponse<{ messageId?: string }>>
}

// Auth API interface
interface AuthApi {
  getState: () => Promise<AuthState>
  signInWithEmail: (email: string, password: string) => Promise<AuthLoginResult>
  signUpWithEmail: (email: string, password: string) => Promise<AuthLoginResult>
  resetPassword: (email: string) => Promise<{ success: boolean; error?: string }>
  signOut: () => Promise<AuthLogoutResult>
  getAccessToken: () => Promise<string | null>
  onStateChanged: (callback: (state: AuthState) => void) => () => void
}

// Billing types
interface WalletBalanceResult {
  balanceCents: number
  currency: string
}

interface CheckoutResult {
  checkoutUrl: string
  sessionId: string
}

// Auto-update download progress
interface UpdateDownloadProgress {
  percent: number
  bytesPerSecond: number
  transferred: number
  total: number
}

// Updater API interface (auto-update)
interface UpdaterApi {
  checkForUpdates: () => Promise<IpcResponse>
  getVersion: () => Promise<IpcResponse<string>>
  onDownloadProgress: (callback: (progress: UpdateDownloadProgress) => void) => () => void
}

// Billing API interface (Yumi only - wallet and top-up)
interface BillingApi {
  getBalance: () => Promise<IpcResponse<WalletBalanceResult>>
  createCheckout: (amountCents: number) => Promise<IpcResponse<CheckoutResult>>
  openCheckout: (url: string) => Promise<IpcResponse>
  redeemCoupon: (couponCode: string) => Promise<IpcResponse>
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
    yumi: YumiApi
    auth: AuthApi
    billing: BillingApi
    updater: UpdaterApi
  }
}
