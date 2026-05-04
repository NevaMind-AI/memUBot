import { ElectronAPI } from '@electron-toolkit/preload'

// IPC Response type
interface IpcResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
}

type MemoryStatus = 'active' | 'archived' | 'deleted'
type MemoryUserControl = 'auto' | 'remember' | 'dont_remember' | 'modified' | 'deleted' | 'paused'
type MemorySensitivityLevel = 'normal' | 'work' | 'sensitive'
type MemoryConflictState = 'none' | 'potential' | 'confirmed'

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
  platform: 'telegram' | 'whatsapp' | 'discord' | 'slack' | 'line' | 'feishu' | 'qq' | 'local'
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
  platform: 'telegram' | 'whatsapp' | 'discord' | 'slack' | 'line' | 'feishu' | 'qq' | 'local'
  isConnected: boolean
  username?: string
  botName?: string
  avatarUrl?: string
  error?: string
}

// LLM Provider type
type LLMProvider = 'claude' | 'minimax' | 'zenmux' | 'ollama' | 'openai' | 'gemini' | 'custom'

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
  // Ollama settings
  ollamaApiKey: string
  ollamaBaseUrl: string
  ollamaModel: string
  // OpenAI settings
  openaiApiKey: string
  openaiBaseUrl: string
  openaiModel: string
  // Gemini settings
  geminiApiKey: string
  geminiModel: string
  // Custom provider settings
  customApiKey: string
  customBaseUrl: string
  customModel: string
  // Shared settings
  maxTokens: number
  temperature: number
  systemPrompt: string
  modelTier: 'agile' | 'smart' | 'deep'
  l0TargetTokens: number
  l1TargetTokens: number
  maxPromptTokens: number
  retrievalEscalationThresholds: {
    scoreThresholdHigh: number
    top1Top2Margin: number
    maxItemsForL1: number
    maxItemsForL2: number
  }
  enableSessionCompression: boolean
  maxArchives: number
  maxRecentMessages: number
  archiveChunkSize: number
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
  qqAppId: string
  qqAppSecret: string
  qqAutoConnect: boolean
  language: string
  experimentalVisualMode: boolean
  experimentalComputerUse: boolean
  showAgentActivity: boolean
  tavilyApiKey: string
  preventSleep: boolean
  fileAccessBoundaryRoot: string
  bashToolEnabled: boolean
  bashToolRequireAuthorizedUser: boolean
  bashToolAllowedPlatforms: Array<'telegram' | 'discord' | 'whatsapp' | 'slack' | 'line' | 'feishu' | 'local' | 'none'>
  bashToolAllowedSources: Array<'message' | 'proactive' | 'system' | 'service'>
}

// Agent API interface
interface AgentApi {
  sendMessage: (message: string) => Promise<IpcResponse<string>>
  getHistory: () => Promise<IpcResponse<ConversationMessage[]>>
  clearHistory: () => Promise<IpcResponse>
}

interface LocalApi {
  sendMessage: (message: string) => Promise<IpcResponse<AppMessage>>
  getStatus: () => Promise<IpcResponse<BotStatus>>
  getMessages: (limit?: number) => Promise<IpcResponse<AppMessage[]>>
  clearMessages: () => Promise<IpcResponse>
  onNewMessage: (callback: (message: AppMessage) => void) => () => void
  onStatusChanged: (callback: (status: BotStatus) => void) => () => void
  onMessagesRefresh: (callback: () => void) => () => void
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

interface QQApi {
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
  getAuditLogs: (date?: string) => Promise<IpcResponse<AuditLogsData>>
  exportLogs: (date?: string) => Promise<IpcResponse<string>>
  getTraces: (date?: string) => Promise<IpcResponse>
  getMetricsSummary: () => Promise<IpcResponse>
  testConnection: (provider: string, config: { apiKey: string; baseUrl?: string; model: string }) => Promise<IpcResponse>
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

interface AuditLogEntry {
  timestamp: string
  level: 'debug' | 'info' | 'warn' | 'error'
  event: string
  traceId?: string
  durationMs?: number
  data?: Record<string, unknown>
  error?: string
}

interface AuditLogsData {
  entries: AuditLogEntry[]
  availableDates: string[]
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
type Platform = 'telegram' | 'discord' | 'whatsapp' | 'slack' | 'line' | 'feishu' | 'qq'

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

// Secure storage stats type
interface SecureStorageStats {
  totalKeys: number
  sensitiveKeys: number
  mcpEnvKeys: number
  isAvailable: boolean
}

// Backup validation result
interface BackupValidationResult {
  valid: boolean
  message: string
  timestamp?: number
}

// Backup import result
interface BackupImportResult {
  success: boolean
  message: string
  imported: number
}

// Dialog result type
interface DialogResult {
  canceled: boolean
  filePath?: string
}

// Security API interface
interface SecurityApi {
  generateCode: () => Promise<IpcResponse<{ code: string }>>
  getCodeInfo: () => Promise<IpcResponse<SecurityCodeInfo>>
  getBoundUsers: (platform?: Platform) => Promise<IpcResponse<BoundUser[]>>
  removeBoundUser: (userId: number, platform?: Platform) => Promise<IpcResponse<{ removed: boolean }>>
  removeBoundUserById: (uniqueId: string, platform: Platform) => Promise<IpcResponse<{ removed: boolean }>>
  clearBoundUsers: (platform?: Platform) => Promise<IpcResponse>
  // Secure Storage Management
  getSecureStorageStats: () => Promise<IpcResponse<SecureStorageStats>>
  exportBackup: (password: string) => Promise<IpcResponse<string>>
  importBackup: (backupData: string, password: string) => Promise<IpcResponse<BackupImportResult>>
  validateBackup: (backupData: string) => Promise<IpcResponse<BackupValidationResult>>
  clearSecureStorage: () => Promise<IpcResponse>
  showSaveBackupDialog: () => Promise<IpcResponse<DialogResult>>
  showOpenBackupDialog: () => Promise<IpcResponse<DialogResult>>
  readBackupFile: (filePath: string) => Promise<IpcResponse<string>>
  writeBackupFile: (filePath: string, content: string) => Promise<IpcResponse>
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
  readEnv: (skillId: string) => Promise<IpcResponse<Record<string, string>>>
  writeEnv: (skillId: string, envVars: Record<string, string>) => Promise<IpcResponse>
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

// Auto-update download progress
interface UpdateDownloadProgress {
  percent: number
  bytesPerSecond: number
  transferred: number
  total: number
}



// Local controlled memory types
interface LocalMemoryItem {
  id: string
  content: string
  memory_type: string
  source_platform: string | null
  source_excerpt: string | null
  created_at: number
  updated_at: number
  confidence: number
  importance: number
  sensitivity_level: MemorySensitivityLevel
  retention_until: number | null
  status: 'active' | 'archived' | 'deleted'
  user_control: 'auto' | 'remember' | 'dont_remember' | 'modified' | 'deleted' | 'paused'
  why_stored: string | null
  conflict_state: 'none' | 'potential' | 'confirmed'
  conflict_notes: string | null
}

interface MemoryProvenance {
  source_platform: string | null
  source_excerpt: string | null
  created_at: number
  updated_at: number
  retention_until: number | null
  why_stored: string | null
  sensitivity_level: MemorySensitivityLevel
  conflict_state: 'none' | 'potential' | 'confirmed'
  conflict_notes: string | null
}

interface MemoryExplanation {
  provenance: MemoryProvenance
}

interface ExplainedLocalMemoryItem extends LocalMemoryItem {
  explanation: MemoryExplanation
}

interface MemoryMatchField {
  field: 'content' | 'memory_type' | 'source_platform' | 'source_excerpt' | 'why_stored' | 'status' | 'user_control' | 'sensitivity_level' | 'conflict_notes'
  value_excerpt: string
  matched_terms: string[]
  score_contribution: number
  reason: string
}

interface MemoryRetrievalExplanation {
  query: string
  matched_fields: MemoryMatchField[]
  source_excerpt: string | null
  created_at: number
  updated_at: number
  retention_until: number | null
  score: number
  score_reasons: string[]
}

interface MemoryRetrievalResult {
  memory: ExplainedLocalMemoryItem
  retrieval_explanation: MemoryRetrievalExplanation
}

interface MemoryEventRecord {
  id: number
  memory_id: string
  event_type: string
  actor: string
  previous_status: MemoryStatus | null
  new_status: MemoryStatus | null
  reason: string | null
  payload_json: string | null
  created_at: number
}

interface MemoryCaptureStatus {
  paused: boolean
}

interface RememberThisInput {
  content: string
  memory_type: string
  source_platform?: string | null
  source_excerpt?: string | null
  confidence?: number
  importance?: number
  sensitivity_level?: MemorySensitivityLevel
  retention_until?: number | null
  status?: 'active' | 'archived' | 'deleted'
  user_control?: 'auto' | 'remember' | 'dont_remember' | 'modified' | 'deleted' | 'paused'
  why_stored?: string | null
}

interface DoNotRememberInput {
  content: string
  memory_type?: string
  source_platform?: string | null
  source_excerpt?: string | null
  sensitivity_level?: MemorySensitivityLevel
  reason?: string | null
}

interface MemorySearchInput {
  query?: string
  limit?: number
  include_archived?: boolean
  status?: 'active' | 'archived' | 'deleted'
  memory_type?: string
  source_platform?: string
  sensitivity_level?: MemorySensitivityLevel
  user_control?: 'auto' | 'remember' | 'dont_remember' | 'modified' | 'deleted' | 'paused'
  created_after?: number
  created_before?: number
  updated_after?: number
  updated_before?: number
  min_confidence?: number
  min_importance?: number
  exclude_sensitive?: boolean
  conflict_state?: MemoryConflictState
}

interface MemoryApi {
  getStatus: () => Promise<IpcResponse<MemoryCaptureStatus>>
  rememberThis: (input: RememberThisInput) => Promise<IpcResponse<LocalMemoryItem>>
  doNotRememberThis: (input: DoNotRememberInput) => Promise<IpcResponse<LocalMemoryItem>>
  get: (id: string) => Promise<IpcResponse<LocalMemoryItem | null>>
  getExplained: (id: string) => Promise<IpcResponse<ExplainedLocalMemoryItem | null>>
  getProvenance: (id: string) => Promise<IpcResponse<MemoryProvenance | null>>
  list: (filters?: Record<string, unknown>) => Promise<IpcResponse<LocalMemoryItem[]>>
  listExplained: (filters?: Record<string, unknown>) => Promise<IpcResponse<ExplainedLocalMemoryItem[]>>
  search: (filters?: MemorySearchInput) => Promise<IpcResponse<MemoryRetrievalResult[]>>
  update: (id: string, updates: Record<string, unknown>) => Promise<IpcResponse<LocalMemoryItem | null>>
  delete: (id: string) => Promise<IpcResponse<{ deleted: boolean }>>
  deleteBySource: (sourcePlatform: string) => Promise<IpcResponse<{ deletedCount: number }>>
  listEvents: (memoryId: string) => Promise<IpcResponse<MemoryEventRecord[]>>
  pauseCapture: (reason?: string) => Promise<IpcResponse<MemoryCaptureStatus>>
  resumeCapture: (reason?: string) => Promise<IpcResponse<MemoryCaptureStatus>>
}

// Updater API interface (auto-update)
interface UpdaterApi {
  checkForUpdates: () => Promise<IpcResponse>
  getVersion: () => Promise<IpcResponse<string>>
  onDownloadProgress: (callback: (progress: UpdateDownloadProgress) => void) => () => void
}

declare global {
  interface Window {
    electron: ElectronAPI
    agent: AgentApi
    local: LocalApi
    file: FileApi
    telegram: TelegramApi
    discord: DiscordApi
    whatsapp: WhatsAppApi
    slack: SlackApi
    line: LineApi
    feishu: FeishuApi
    qq: QQApi
    settings: SettingsApi
    security: SecurityApi
    llm: LLMApi
    startup: StartupApi
    skills: SkillsApi
    services: ServicesApi
    updater: UpdaterApi
    memory: MemoryApi
  }
}
