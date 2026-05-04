import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Agent API
const agentApi = {
  sendMessage: (message: string) => ipcRenderer.invoke('agent:send-message', message),
  getHistory: () => ipcRenderer.invoke('agent:get-history'),
  clearHistory: () => ipcRenderer.invoke('agent:clear-history')
}

const localApi = {
  sendMessage: (message: string) => ipcRenderer.invoke('local:send-message', message),
  getStatus: () => ipcRenderer.invoke('local:status'),
  getMessages: (limit?: number) => ipcRenderer.invoke('local:get-messages', limit),
  clearMessages: () => ipcRenderer.invoke('local:clear-messages'),
  onNewMessage: (callback: (message: unknown) => void) => {
    ipcRenderer.on('local:new-message', (_event, message) => callback(message))
    return () => ipcRenderer.removeAllListeners('local:new-message')
  },
  onStatusChanged: (callback: (status: unknown) => void) => {
    ipcRenderer.on('local:status-changed', (_event, status) => callback(status))
    return () => ipcRenderer.removeAllListeners('local:status-changed')
  },
  onMessagesRefresh: (callback: () => void) => {
    ipcRenderer.on('local:messages-refresh', () => callback())
    return () => ipcRenderer.removeAllListeners('local:messages-refresh')
  }
}

// File API
const fileApi = {
  read: (path: string) => ipcRenderer.invoke('file:read', path),
  write: (path: string, content: string) => ipcRenderer.invoke('file:write', path, content),
  list: (path: string) => ipcRenderer.invoke('file:list', path),
  delete: (path: string) => ipcRenderer.invoke('file:delete', path),
  exists: (path: string) => ipcRenderer.invoke('file:exists', path),
  info: (path: string) => ipcRenderer.invoke('file:info', path)
}

// Telegram API (single-user mode)
const telegramApi = {
  connect: () => ipcRenderer.invoke('telegram:connect'),
  disconnect: () => ipcRenderer.invoke('telegram:disconnect'),
  getStatus: () => ipcRenderer.invoke('telegram:status'),
  getMessages: (limit?: number) => ipcRenderer.invoke('telegram:get-messages', limit),
  // Event listeners
  onNewMessage: (callback: (message: unknown) => void) => {
    ipcRenderer.on('telegram:new-message', (_event, message) => callback(message))
    return () => ipcRenderer.removeAllListeners('telegram:new-message')
  },
  onStatusChanged: (callback: (status: unknown) => void) => {
    ipcRenderer.on('telegram:status-changed', (_event, status) => callback(status))
    return () => ipcRenderer.removeAllListeners('telegram:status-changed')
  },
  onMessagesRefresh: (callback: () => void) => {
    ipcRenderer.on('telegram:messages-refresh', () => callback())
    return () => ipcRenderer.removeAllListeners('telegram:messages-refresh')
  }
}

// Settings API
const settingsApi = {
  get: () => ipcRenderer.invoke('settings:get'),
  save: (settings: unknown) => ipcRenderer.invoke('settings:save', settings),
  getMcpConfig: () => ipcRenderer.invoke('settings:get-mcp-config'),
  saveMcpConfig: (config: unknown) => ipcRenderer.invoke('settings:save-mcp-config', config),
  getMcpStatus: () => ipcRenderer.invoke('settings:get-mcp-status'),
  reloadMcp: () => ipcRenderer.invoke('settings:reload-mcp'),
  getStorageInfo: () => ipcRenderer.invoke('settings:get-storage-info'),
  openMessagesFolder: (platform?: string) => ipcRenderer.invoke('settings:open-messages-folder', platform),
  clearCache: () => ipcRenderer.invoke('settings:clear-cache'),
  openDevTools: () => ipcRenderer.invoke('settings:open-devtools'),
  getLogs: () => ipcRenderer.invoke('settings:get-logs'),
  clearLogs: () => ipcRenderer.invoke('settings:clear-logs'),
  getAuditLogs: (date?: string) => ipcRenderer.invoke('settings:get-audit-logs', date),
  exportLogs: (date?: string) => ipcRenderer.invoke('settings:export-logs', date),
  getTraces: (date?: string) => ipcRenderer.invoke('settings:get-traces', date),
  getMetricsSummary: () => ipcRenderer.invoke('settings:get-metrics-summary'),
  testConnection: (provider: string, config: { apiKey: string; baseUrl?: string; model: string }) =>
    ipcRenderer.invoke('settings:test-connection', provider, config)
}

// Security API
type Platform = 'telegram' | 'discord' | 'slack' | 'feishu' | 'line' | 'whatsapp'

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

const securityApi = {
  generateCode: () => ipcRenderer.invoke('security:generate-code'),
  getCodeInfo: () => ipcRenderer.invoke('security:get-code-info'),
  getBoundUsers: (platform?: Platform) => ipcRenderer.invoke('security:get-bound-users', platform),
  removeBoundUser: (userId: number, platform: Platform = 'telegram') =>
    ipcRenderer.invoke('security:remove-bound-user', userId, platform),
  removeBoundUserById: (uniqueId: string, platform: Platform) =>
    ipcRenderer.invoke('security:remove-bound-user-by-id', uniqueId, platform),
  clearBoundUsers: (platform?: Platform) => ipcRenderer.invoke('security:clear-bound-users', platform),
  // Secure Storage Management
  getSecureStorageStats: () => ipcRenderer.invoke('security:get-secure-storage-stats'),
  exportBackup: (password: string) => ipcRenderer.invoke('security:export-backup', password),
  importBackup: (backupData: string, password: string) =>
    ipcRenderer.invoke('security:import-backup', backupData, password),
  validateBackup: (backupData: string) => ipcRenderer.invoke('security:validate-backup', backupData),
  clearSecureStorage: () => ipcRenderer.invoke('security:clear-secure-storage'),
  showSaveBackupDialog: () => ipcRenderer.invoke('security:show-save-backup-dialog'),
  showOpenBackupDialog: () => ipcRenderer.invoke('security:show-open-backup-dialog'),
  readBackupFile: (filePath: string) => ipcRenderer.invoke('security:read-backup-file', filePath),
  writeBackupFile: (filePath: string, content: string) =>
    ipcRenderer.invoke('security:write-backup-file', filePath, content)
}

// Discord API (single-user mode)
const discordApi = {
  connect: () => ipcRenderer.invoke('discord:connect'),
  disconnect: () => ipcRenderer.invoke('discord:disconnect'),
  getStatus: () => ipcRenderer.invoke('discord:status'),
  getMessages: (limit?: number) => ipcRenderer.invoke('discord:get-messages', limit),
  // Event listeners
  onNewMessage: (callback: (message: unknown) => void) => {
    ipcRenderer.on('discord:new-message', (_event, message) => callback(message))
    return () => ipcRenderer.removeAllListeners('discord:new-message')
  },
  onStatusChanged: (callback: (status: unknown) => void) => {
    ipcRenderer.on('discord:status-changed', (_event, status) => callback(status))
    return () => ipcRenderer.removeAllListeners('discord:status-changed')
  },
  onMessagesRefresh: (callback: () => void) => {
    ipcRenderer.on('discord:messages-refresh', () => callback())
    return () => ipcRenderer.removeAllListeners('discord:messages-refresh')
  }
}

// WhatsApp API (single-user mode)
const whatsappApi = {
  connect: () => ipcRenderer.invoke('whatsapp:connect'),
  disconnect: () => ipcRenderer.invoke('whatsapp:disconnect'),
  getStatus: () => ipcRenderer.invoke('whatsapp:status'),
  getQRCode: () => ipcRenderer.invoke('whatsapp:get-qr'),
  getMessages: (limit?: number) => ipcRenderer.invoke('whatsapp:get-messages', limit),
  // Event listeners
  onNewMessage: (callback: (message: unknown) => void) => {
    ipcRenderer.on('whatsapp:new-message', (_event, message) => callback(message))
    return () => ipcRenderer.removeAllListeners('whatsapp:new-message')
  },
  onStatusChanged: (callback: (status: unknown) => void) => {
    ipcRenderer.on('whatsapp:status-changed', (_event, status) => callback(status))
    return () => ipcRenderer.removeAllListeners('whatsapp:status-changed')
  },
  onMessagesRefresh: (callback: () => void) => {
    ipcRenderer.on('whatsapp:messages-refresh', () => callback())
    return () => ipcRenderer.removeAllListeners('whatsapp:messages-refresh')
  }
}

// Slack API (single-user mode)
const slackApi = {
  connect: () => ipcRenderer.invoke('slack:connect'),
  disconnect: () => ipcRenderer.invoke('slack:disconnect'),
  getStatus: () => ipcRenderer.invoke('slack:status'),
  getMessages: (limit?: number) => ipcRenderer.invoke('slack:get-messages', limit),
  // Event listeners
  onNewMessage: (callback: (message: unknown) => void) => {
    ipcRenderer.on('slack:new-message', (_event, message) => callback(message))
    return () => ipcRenderer.removeAllListeners('slack:new-message')
  },
  onStatusChanged: (callback: (status: unknown) => void) => {
    ipcRenderer.on('slack:status-changed', (_event, status) => callback(status))
    return () => ipcRenderer.removeAllListeners('slack:status-changed')
  },
  onMessagesRefresh: (callback: () => void) => {
    ipcRenderer.on('slack:messages-refresh', () => callback())
    return () => ipcRenderer.removeAllListeners('slack:messages-refresh')
  }
}

// Line API (single-user mode)
const lineApi = {
  connect: () => ipcRenderer.invoke('line:connect'),
  disconnect: () => ipcRenderer.invoke('line:disconnect'),
  getStatus: () => ipcRenderer.invoke('line:status'),
  getMessages: (limit?: number) => ipcRenderer.invoke('line:get-messages', limit),
  // Event listeners
  onNewMessage: (callback: (message: unknown) => void) => {
    ipcRenderer.on('line:new-message', (_event, message) => callback(message))
    return () => ipcRenderer.removeAllListeners('line:new-message')
  },
  onStatusChanged: (callback: (status: unknown) => void) => {
    ipcRenderer.on('line:status-changed', (_event, status) => callback(status))
    return () => ipcRenderer.removeAllListeners('line:status-changed')
  },
  onMessagesRefresh: (callback: () => void) => {
    ipcRenderer.on('line:messages-refresh', () => callback())
    return () => ipcRenderer.removeAllListeners('line:messages-refresh')
  }
}

// Feishu API (single-user mode)
const feishuApi = {
  connect: () => ipcRenderer.invoke('feishu:connect'),
  disconnect: () => ipcRenderer.invoke('feishu:disconnect'),
  getStatus: () => ipcRenderer.invoke('feishu:status'),
  getMessages: (limit?: number) => ipcRenderer.invoke('feishu:get-messages', limit),
  // Event listeners
  onNewMessage: (callback: (message: unknown) => void) => {
    ipcRenderer.on('feishu:new-message', (_event, message) => callback(message))
    return () => ipcRenderer.removeAllListeners('feishu:new-message')
  },
  onStatusChanged: (callback: (status: unknown) => void) => {
    ipcRenderer.on('feishu:status-changed', (_event, status) => callback(status))
    return () => ipcRenderer.removeAllListeners('feishu:status-changed')
  },
  onMessagesRefresh: (callback: () => void) => {
    ipcRenderer.on('feishu:messages-refresh', () => callback())
    return () => ipcRenderer.removeAllListeners('feishu:messages-refresh')
  }
}

// QQ API (single-user mode)
const qqApi = {
  connect: () => ipcRenderer.invoke('qq:connect'),
  disconnect: () => ipcRenderer.invoke('qq:disconnect'),
  getStatus: () => ipcRenderer.invoke('qq:status'),
  getMessages: (limit?: number) => ipcRenderer.invoke('qq:get-messages', limit),
  // Event listeners
  onNewMessage: (callback: (message: unknown) => void) => {
    ipcRenderer.on('qq:new-message', (_event, message) => callback(message))
    return () => ipcRenderer.removeAllListeners('qq:new-message')
  },
  onStatusChanged: (callback: (status: unknown) => void) => {
    ipcRenderer.on('qq:status-changed', (_event, status) => callback(status))
    return () => ipcRenderer.removeAllListeners('qq:status-changed')
  },
  onMessagesRefresh: (callback: () => void) => {
    ipcRenderer.on('qq:messages-refresh', () => callback())
    return () => ipcRenderer.removeAllListeners('qq:messages-refresh')
  }
}

// LLM API
const llmApi = {
  getStatus: () => ipcRenderer.invoke('llm:get-status'),
  abort: () => ipcRenderer.invoke('llm:abort'),
  isProcessing: () => ipcRenderer.invoke('llm:is-processing'),
  getActivityLog: () => ipcRenderer.invoke('llm:get-activity-log'),
  clearActivityLog: () => ipcRenderer.invoke('llm:clear-activity-log'),
  // Event listener for status changes
  onStatusChanged: (callback: (status: unknown) => void) => {
    ipcRenderer.on('llm:status-changed', (_event, status) => callback(status))
    return () => ipcRenderer.removeAllListeners('llm:status-changed')
  },
  // Event listener for activity changes
  onActivityChanged: (callback: (activity: unknown) => void) => {
    ipcRenderer.on('llm:activity-changed', (_event, activity) => callback(activity))
    return () => ipcRenderer.removeAllListeners('llm:activity-changed')
  }
}

// Startup API
const startupApi = {
  getStatus: () => ipcRenderer.invoke('get-startup-status'),
  // Event listener for startup status changes
  onStatusChanged: (callback: (status: unknown) => void) => {
    ipcRenderer.on('startup-status', (_event, status) => callback(status))
    return () => ipcRenderer.removeAllListeners('startup-status')
  }
}

// Skills API
const skillsApi = {
  getInstalled: () => ipcRenderer.invoke('skills:getInstalled'),
  setEnabled: (skillId: string, enabled: boolean) =>
    ipcRenderer.invoke('skills:setEnabled', skillId, enabled),
  delete: (skillId: string) => ipcRenderer.invoke('skills:delete', skillId),
  importFromDirectory: () => ipcRenderer.invoke('skills:importFromDirectory'),
  searchGitHub: (query: string) => ipcRenderer.invoke('skills:searchGitHub', query),
  installFromGitHub: (skillPath: string) =>
    ipcRenderer.invoke('skills:installFromGitHub', skillPath),
  getContent: (skillId: string) => ipcRenderer.invoke('skills:getContent', skillId),
  openDirectory: () => ipcRenderer.invoke('skills:openDirectory'),
  setGitHubToken: (token: string | undefined) =>
    ipcRenderer.invoke('skills:setGitHubToken', token),
  getGitHubToken: () => ipcRenderer.invoke('skills:getGitHubToken'),
  readEnv: (skillId: string) => ipcRenderer.invoke('skills:readEnv', skillId),
  writeEnv: (skillId: string, envVars: Record<string, string>) =>
    ipcRenderer.invoke('skills:writeEnv', skillId, envVars)
}

// Services API (background services management)
const servicesApi = {
  list: () => ipcRenderer.invoke('service:list'),
  get: (serviceId: string) => ipcRenderer.invoke('service:get', serviceId),
  start: (serviceId: string) => ipcRenderer.invoke('service:start', serviceId),
  stop: (serviceId: string) => ipcRenderer.invoke('service:stop', serviceId),
  delete: (serviceId: string) => ipcRenderer.invoke('service:delete', serviceId),
  getDir: () => ipcRenderer.invoke('service:get-dir'),
  openDir: () => ipcRenderer.invoke('service:open-dir'),
  // Event listener for service status changes
  onStatusChanged: (callback: (data: { serviceId: string; status: string }) => void) => {
    ipcRenderer.on('service:status-changed', (_event, data) => callback(data))
    return () => ipcRenderer.removeAllListeners('service:status-changed')
  },
  // Event listener for service list changes (create/delete)
  onListChanged: (callback: () => void) => {
    ipcRenderer.on('service:list-changed', () => callback())
    return () => ipcRenderer.removeAllListeners('service:list-changed')
  }
}



// Memory API (local controlled memory actions)
const memoryApi = {
  getStatus: () => ipcRenderer.invoke('memory:get-status'),
  rememberThis: (input: unknown) => ipcRenderer.invoke('memory:remember-this', input),
  doNotRememberThis: (input: unknown) => ipcRenderer.invoke('memory:do-not-remember-this', input),
  get: (id: string) => ipcRenderer.invoke('memory:get', id),
  getExplained: (id: string) => ipcRenderer.invoke('memory:get-explained', id),
  getProvenance: (id: string) => ipcRenderer.invoke('memory:get-provenance', id),
  list: (filters?: unknown) => ipcRenderer.invoke('memory:list', filters),
  listExplained: (filters?: unknown) => ipcRenderer.invoke('memory:list-explained', filters),
  search: (filters?: unknown) => ipcRenderer.invoke('memory:search', filters),
  update: (id: string, updates: unknown) => ipcRenderer.invoke('memory:update', id, updates),
  delete: (id: string) => ipcRenderer.invoke('memory:delete', id),
  deleteBySource: (sourcePlatform: string) => ipcRenderer.invoke('memory:delete-by-source', sourcePlatform),
  listEvents: (memoryId: string) => ipcRenderer.invoke('memory:list-events', memoryId),
  pauseCapture: (reason?: string) => ipcRenderer.invoke('memory:pause-capture', reason),
  resumeCapture: (reason?: string) => ipcRenderer.invoke('memory:resume-capture', reason),
}

// Updater API (auto-update)
const updaterApi = {
  checkForUpdates: () => ipcRenderer.invoke('updater:check-for-updates'),
  getVersion: () => ipcRenderer.invoke('updater:get-version'),
  // Event listener for download progress
  onDownloadProgress: (
    callback: (progress: { percent: number; bytesPerSecond: number; transferred: number; total: number }) => void
  ) => {
    ipcRenderer.on('updater:download-progress', (_event, progress) => callback(progress))
    return () => ipcRenderer.removeAllListeners('updater:download-progress')
  }
}

// Expose APIs to renderer
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('agent', agentApi)
    contextBridge.exposeInMainWorld('local', localApi)
    contextBridge.exposeInMainWorld('file', fileApi)
    contextBridge.exposeInMainWorld('telegram', telegramApi)
    contextBridge.exposeInMainWorld('discord', discordApi)
    contextBridge.exposeInMainWorld('whatsapp', whatsappApi)
    contextBridge.exposeInMainWorld('slack', slackApi)
    contextBridge.exposeInMainWorld('line', lineApi)
    contextBridge.exposeInMainWorld('feishu', feishuApi)
    contextBridge.exposeInMainWorld('qq', qqApi)
    contextBridge.exposeInMainWorld('settings', settingsApi)
    contextBridge.exposeInMainWorld('security', securityApi)
    contextBridge.exposeInMainWorld('llm', llmApi)
    contextBridge.exposeInMainWorld('startup', startupApi)
    contextBridge.exposeInMainWorld('skills', skillsApi)
    contextBridge.exposeInMainWorld('services', servicesApi)
    contextBridge.exposeInMainWorld('updater', updaterApi)
    contextBridge.exposeInMainWorld('memory', memoryApi)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.agent = agentApi
  // @ts-ignore (define in dts)
  window.local = localApi
  // @ts-ignore (define in dts)
  window.file = fileApi
  // @ts-ignore (define in dts)
  window.telegram = telegramApi
  // @ts-ignore (define in dts)
  window.discord = discordApi
  // @ts-ignore (define in dts)
  window.whatsapp = whatsappApi
  // @ts-ignore (define in dts)
  window.slack = slackApi
  // @ts-ignore (define in dts)
  window.line = lineApi
  // @ts-ignore (define in dts)
  window.feishu = feishuApi
  // @ts-ignore (define in dts)
  window.qq = qqApi
  // @ts-ignore (define in dts)
  window.settings = settingsApi
  // @ts-ignore (define in dts)
  window.security = securityApi
  // @ts-ignore (define in dts)
  window.llm = llmApi
  // @ts-ignore (define in dts)
  window.startup = startupApi
  // @ts-ignore (define in dts)
  window.skills = skillsApi
  // @ts-ignore (define in dts)
  window.services = servicesApi
  // @ts-ignore (define in dts)
  window.updater = updaterApi
  // @ts-ignore (define in dts)
  window.memory = memoryApi
}
