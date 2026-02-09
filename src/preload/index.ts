import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Agent API
const agentApi = {
  sendMessage: (message: string) => ipcRenderer.invoke('agent:send-message', message),
  getHistory: () => ipcRenderer.invoke('agent:get-history'),
  clearHistory: () => ipcRenderer.invoke('agent:clear-history')
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
  clearLogs: () => ipcRenderer.invoke('settings:clear-logs')
}

// Security API
type Platform = 'telegram' | 'discord' | 'slack' | 'feishu'

const securityApi = {
  generateCode: () => ipcRenderer.invoke('security:generate-code'),
  getCodeInfo: () => ipcRenderer.invoke('security:get-code-info'),
  getBoundUsers: (platform?: Platform) => ipcRenderer.invoke('security:get-bound-users', platform),
  removeBoundUser: (userId: number, platform: Platform = 'telegram') =>
    ipcRenderer.invoke('security:remove-bound-user', userId, platform),
  removeBoundUserById: (uniqueId: string, platform: Platform) =>
    ipcRenderer.invoke('security:remove-bound-user-by-id', uniqueId, platform),
  clearBoundUsers: (platform?: Platform) => ipcRenderer.invoke('security:clear-bound-users', platform)
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
  getGitHubToken: () => ipcRenderer.invoke('skills:getGitHubToken')
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

// Analytics API (for receiving events from main process)
const analyticsApi = {
  // Get initial analytics config (user_id, common params)
  getConfig: () => ipcRenderer.invoke('analytics:get-config'),
  // Event listener for tracking events from main process
  onTrack: (callback: (data: { eventName: string; attributes?: Record<string, string> }) => void) => {
    ipcRenderer.on('analytics:track', (_event, data) => callback(data))
    return () => ipcRenderer.removeAllListeners('analytics:track')
  },
  // Event listener for setting user info
  onSetUser: (callback: (data: { userId: string; attributes?: Record<string, string> }) => void) => {
    ipcRenderer.on('analytics:set-user', (_event, data) => callback(data))
    return () => ipcRenderer.removeAllListeners('analytics:set-user')
  }
}

// Yumi API (Easemob message handling via main process)
// This API bridges the renderer (Easemob SDK) with main process (storage, agent)
const yumiApi = {
  // Message retrieval
  getMessages: (limit?: number) => ipcRenderer.invoke('yumi:get-messages', limit),
  getStatus: () => ipcRenderer.invoke('yumi:status'),

  // Forward incoming Easemob messages to main for storage and agent processing
  storeMessage: (message: unknown) => ipcRenderer.invoke('yumi:store-message', message),

  // Notify main process of connection status changes
  updateConnectionStatus: (isConnected: boolean, error?: string) =>
    ipcRenderer.invoke('yumi:connection-status', isConnected, error),

  // Event listeners (from main process)
  onNewMessage: (callback: (message: unknown) => void) => {
    ipcRenderer.on('yumi:new-message', (_event, message) => callback(message))
    return () => ipcRenderer.removeAllListeners('yumi:new-message')
  },
  onStatusChanged: (callback: (status: unknown) => void) => {
    ipcRenderer.on('yumi:status-changed', (_event, status) => callback(status))
    return () => ipcRenderer.removeAllListeners('yumi:status-changed')
  },
  onMessagesRefresh: (callback: () => void) => {
    ipcRenderer.on('yumi:messages-refresh', () => callback())
    return () => ipcRenderer.removeAllListeners('yumi:messages-refresh')
  },

  // Listen for send message requests from main process
  // Main process calls this when agent needs to reply via Easemob
  onSendMessage: (
    callback: (request: {
      targetUserId: string
      content: string
      type: 'text' | 'custom'
      customEvent?: string
      customExts?: Record<string, unknown>
      responseChannel?: string
    }) => void
  ) => {
    ipcRenderer.on('yumi:send-message', (_event, request) => callback(request))
    return () => ipcRenderer.removeAllListeners('yumi:send-message')
  }
}

// Auth API (Yumi only - Firebase authentication)
const authApi = {
  getState: () => ipcRenderer.invoke('auth:getState'),
  signInWithEmail: (email: string, password: string) =>
    ipcRenderer.invoke('auth:signInWithEmail', email, password),
  signOut: () => ipcRenderer.invoke('auth:signOut'),
  getAccessToken: () => ipcRenderer.invoke('auth:getAccessToken'),
  // Event listener for auth state changes
  onStateChanged: (callback: (state: unknown) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, state: unknown) => {
      console.log('[PreloadAuth] stateChanged received')
      callback(state)
    }
    ipcRenderer.on('auth:stateChanged', handler)
    return () => ipcRenderer.removeListener('auth:stateChanged', handler)
  }
}

// Billing API (Yumi only - wallet and top-up)
const billingApi = {
  getBalance: () => ipcRenderer.invoke('billing:getBalance'),
  createCheckout: (amountCents: number) =>
    ipcRenderer.invoke('billing:createCheckout', amountCents),
  openCheckout: (url: string) => ipcRenderer.invoke('billing:openCheckout', url)
}

// Expose APIs to renderer
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('agent', agentApi)
    contextBridge.exposeInMainWorld('file', fileApi)
    contextBridge.exposeInMainWorld('telegram', telegramApi)
    contextBridge.exposeInMainWorld('discord', discordApi)
    contextBridge.exposeInMainWorld('whatsapp', whatsappApi)
    contextBridge.exposeInMainWorld('slack', slackApi)
    contextBridge.exposeInMainWorld('line', lineApi)
    contextBridge.exposeInMainWorld('feishu', feishuApi)
    contextBridge.exposeInMainWorld('settings', settingsApi)
    contextBridge.exposeInMainWorld('security', securityApi)
    contextBridge.exposeInMainWorld('llm', llmApi)
    contextBridge.exposeInMainWorld('startup', startupApi)
    contextBridge.exposeInMainWorld('skills', skillsApi)
    contextBridge.exposeInMainWorld('services', servicesApi)
    contextBridge.exposeInMainWorld('analytics', analyticsApi)
    contextBridge.exposeInMainWorld('yumi', yumiApi)
    contextBridge.exposeInMainWorld('auth', authApi)
    contextBridge.exposeInMainWorld('billing', billingApi)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.agent = agentApi
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
  window.analytics = analyticsApi
  // @ts-ignore (define in dts)
  window.yumi = yumiApi
  // @ts-ignore (define in dts)
  window.auth = authApi
  // @ts-ignore (define in dts)
  window.billing = billingApi
}
