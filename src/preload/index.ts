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
  }
}

// Proxy API
const proxyApi = {
  getConfig: () => ipcRenderer.invoke('proxy:get-config'),
  saveConfig: (config: unknown) => ipcRenderer.invoke('proxy:save-config', config)
}

// Settings API
const settingsApi = {
  get: () => ipcRenderer.invoke('settings:get'),
  save: (settings: unknown) => ipcRenderer.invoke('settings:save', settings)
}

// Tailscale API
const tailscaleApi = {
  getStatus: () => ipcRenderer.invoke('tailscale:get-status'),
  connect: () => ipcRenderer.invoke('tailscale:connect'),
  disconnect: () => ipcRenderer.invoke('tailscale:disconnect'),
  login: () => ipcRenderer.invoke('tailscale:login'),
  logout: () => ipcRenderer.invoke('tailscale:logout'),
  ping: (target: string) => ipcRenderer.invoke('tailscale:ping', target),
  // Event listener for status changes
  onStatusChanged: (callback: (status: unknown) => void) => {
    ipcRenderer.on('tailscale:status-changed', (_event, status) => callback(status))
    return () => ipcRenderer.removeAllListeners('tailscale:status-changed')
  }
}

// Security API
type Platform = 'telegram' | 'discord' | 'slack'

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
  }
}

// LLM API
const llmApi = {
  getStatus: () => ipcRenderer.invoke('llm:get-status'),
  abort: () => ipcRenderer.invoke('llm:abort'),
  isProcessing: () => ipcRenderer.invoke('llm:is-processing'),
  // Event listener for status changes
  onStatusChanged: (callback: (status: unknown) => void) => {
    ipcRenderer.on('llm:status-changed', (_event, status) => callback(status))
    return () => ipcRenderer.removeAllListeners('llm:status-changed')
  }
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
    contextBridge.exposeInMainWorld('proxy', proxyApi)
    contextBridge.exposeInMainWorld('settings', settingsApi)
    contextBridge.exposeInMainWorld('tailscale', tailscaleApi)
    contextBridge.exposeInMainWorld('security', securityApi)
    contextBridge.exposeInMainWorld('llm', llmApi)
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
  window.proxy = proxyApi
  // @ts-ignore (define in dts)
  window.settings = settingsApi
  // @ts-ignore (define in dts)
  window.tailscale = tailscaleApi
  // @ts-ignore (define in dts)
  window.security = securityApi
  // @ts-ignore (define in dts)
  window.llm = llmApi
}
