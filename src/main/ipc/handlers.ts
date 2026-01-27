import { ipcMain } from 'electron'
import { agentService } from '../services/agent.service'
import { fileService } from '../services/file.service'
import { setupTelegramHandlers } from './telegram.handlers'
import { setupProxyHandlers } from './proxy.handlers'
import { setupSettingsHandlers } from './settings.handlers'
import { setupTailscaleHandlers } from './tailscale.handlers'
import { setupSecurityHandlers } from './security.handlers'
import type { IpcResponse, FileInfo } from '../types'

/**
 * Setup all IPC handlers for main process
 */
export function setupIpcHandlers(): void {
  setupAgentHandlers()
  setupFileHandlers()
  setupTelegramHandlers()
  setupProxyHandlers()
  setupSettingsHandlers()
  setupTailscaleHandlers()
  setupSecurityHandlers()
}

/**
 * Setup agent-related IPC handlers
 */
function setupAgentHandlers(): void {
  // Send message to agent
  ipcMain.handle(
    'agent:send-message',
    async (_event, message: string): Promise<IpcResponse<string>> => {
      try {
        const response = await agentService.processMessage(message)

        if (response.success) {
          return { success: true, data: response.message }
        } else {
          return { success: false, error: response.error }
        }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error)
        }
      }
    }
  )

  // Get conversation history
  ipcMain.handle('agent:get-history', async (): Promise<IpcResponse> => {
    try {
      const history = agentService.getHistory()
      return { success: true, data: history }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  })

  // Clear conversation history
  ipcMain.handle('agent:clear-history', async (): Promise<IpcResponse> => {
    try {
      agentService.clearHistory()
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  })
}

/**
 * Setup file-related IPC handlers
 */
function setupFileHandlers(): void {
  // Read file
  ipcMain.handle(
    'file:read',
    async (_event, path: string): Promise<IpcResponse<string>> => {
      try {
        const content = await fileService.readFile(path)
        return { success: true, data: content }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error)
        }
      }
    }
  )

  // Write file
  ipcMain.handle(
    'file:write',
    async (_event, path: string, content: string): Promise<IpcResponse> => {
      try {
        await fileService.writeFile(path, content)
        return { success: true }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error)
        }
      }
    }
  )

  // List directory
  ipcMain.handle(
    'file:list',
    async (_event, path: string): Promise<IpcResponse<FileInfo[]>> => {
      try {
        const files = await fileService.listDirectory(path)
        return { success: true, data: files }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error)
        }
      }
    }
  )

  // Delete file
  ipcMain.handle(
    'file:delete',
    async (_event, path: string): Promise<IpcResponse> => {
      try {
        await fileService.deleteFile(path)
        return { success: true }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error)
        }
      }
    }
  )

  // Check if exists
  ipcMain.handle(
    'file:exists',
    async (_event, path: string): Promise<IpcResponse<boolean>> => {
      try {
        const exists = await fileService.exists(path)
        return { success: true, data: exists }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error)
        }
      }
    }
  )

  // Get file info
  ipcMain.handle(
    'file:info',
    async (_event, path: string): Promise<IpcResponse<FileInfo>> => {
      try {
        const info = await fileService.getFileInfo(path)
        return { success: true, data: info }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error)
        }
      }
    }
  )
}
