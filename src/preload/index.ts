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

// Expose APIs to renderer
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('agent', agentApi)
    contextBridge.exposeInMainWorld('file', fileApi)
    contextBridge.exposeInMainWorld('telegram', telegramApi)
    contextBridge.exposeInMainWorld('proxy', proxyApi)
    contextBridge.exposeInMainWorld('settings', settingsApi)
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
  window.proxy = proxyApi
  // @ts-ignore (define in dts)
  window.settings = settingsApi
}
