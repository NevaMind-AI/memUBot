import { ipcMain, app, shell } from 'electron'
import * as fs from 'fs/promises'
import * as path from 'path'
import { loadSettings, saveSettings, type AppSettings } from '../config/settings.config'
import { mcpService } from '../services/mcp.service'
import type { IpcResponse } from '../types'

/**
 * Storage info for each folder
 */
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

/**
 * Calculate folder size recursively
 */
async function getFolderSize(folderPath: string): Promise<number> {
  try {
    const stats = await fs.stat(folderPath)
    if (!stats.isDirectory()) {
      return stats.size
    }

    const entries = await fs.readdir(folderPath, { withFileTypes: true })
    let total = 0

    for (const entry of entries) {
      const fullPath = path.join(folderPath, entry.name)
      if (entry.isDirectory()) {
        total += await getFolderSize(fullPath)
      } else {
        try {
          const fileStats = await fs.stat(fullPath)
          total += fileStats.size
        } catch {
          // Skip files that can't be read
        }
      }
    }

    return total
  } catch {
    return 0
  }
}

/**
 * MCP Server Configuration Type
 */
interface McpServerConfig {
  [key: string]: {
    command: string
    args?: string[]
    env?: Record<string, string>
    disabled?: boolean
    builtin?: boolean
  }
}

/**
 * Get the path to the MCP config file
 */
function getMcpConfigPath(): string {
  return path.join(app.getPath('userData'), 'mcp-config.json')
}

/**
 * Load user MCP configuration (without builtin servers)
 */
async function loadUserMcpConfig(): Promise<McpServerConfig> {
  try {
    const configPath = getMcpConfigPath()
    const content = await fs.readFile(configPath, 'utf-8')
    return JSON.parse(content)
  } catch {
    return {}
  }
}

/**
 * Save MCP configuration (preserves builtin server settings)
 */
async function saveMcpConfig(config: McpServerConfig): Promise<void> {
  const configPath = getMcpConfigPath()
  // Remove builtin flag from saved config (it's determined by code)
  const cleanConfig: McpServerConfig = {}
  for (const [name, serverConfig] of Object.entries(config)) {
    const { builtin, ...rest } = serverConfig
    cleanConfig[name] = rest
  }
  await fs.writeFile(configPath, JSON.stringify(cleanConfig, null, 2), 'utf-8')
}

/**
 * Setup settings-related IPC handlers
 */
export function setupSettingsHandlers(): void {
  // Get all settings
  ipcMain.handle('settings:get', async (): Promise<IpcResponse<AppSettings>> => {
    try {
      const settings = await loadSettings()
      return { success: true, data: settings }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  })

  // Save settings
  ipcMain.handle(
    'settings:save',
    async (_event, updates: Partial<AppSettings>): Promise<IpcResponse> => {
      try {
        // Get current settings to detect changes
        const previousSettings = await loadSettings()
        const previousMemuApiKey = previousSettings.memuApiKey
        
        await saveSettings(updates)
        
        // Check if memuApiKey was set (from empty to non-empty)
        const newMemuApiKey = updates.memuApiKey
        if (newMemuApiKey && newMemuApiKey.trim() !== '' && 
            (!previousMemuApiKey || previousMemuApiKey.trim() === '')) {
          // memuApiKey was just configured, try to start proactive service
          console.log('[Settings] memuApiKey was set, attempting to start proactive service')
          try {
            const { proactiveService } = await import('../services/proactive.service')
            if (!proactiveService.isActive()) {
              const started = await proactiveService.start()
              if (started) {
                console.log('[Settings] Proactive service started successfully')
              }
            }
          } catch (err) {
            console.error('[Settings] Failed to start proactive service:', err)
            // Don't fail the save operation
          }
        }
        
        return { success: true }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error)
        }
      }
    }
  )

  // Get MCP configuration (includes builtin servers)
  ipcMain.handle('settings:get-mcp-config', async (): Promise<IpcResponse<McpServerConfig>> => {
    try {
      // Use mcpService to get full config with builtin servers
      const config = await mcpService.getFullConfig()
      return { success: true, data: config }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  })

  // Save MCP configuration
  ipcMain.handle(
    'settings:save-mcp-config',
    async (_event, config: McpServerConfig): Promise<IpcResponse> => {
      try {
        await saveMcpConfig(config)
        // Reload MCP service to apply changes
        await mcpService.reload()
        return { success: true }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error)
        }
      }
    }
  )

  // Get MCP server status
  ipcMain.handle('settings:get-mcp-status', async (): Promise<IpcResponse> => {
    try {
      const status = mcpService.getServerStatus()
      return { success: true, data: status }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  })

  // Reload MCP servers
  ipcMain.handle('settings:reload-mcp', async (): Promise<IpcResponse> => {
    try {
      await mcpService.reload()
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  })

  // Get storage info
  ipcMain.handle('settings:get-storage-info', async (): Promise<IpcResponse<StorageInfo>> => {
    try {
      const userDataPath = app.getPath('userData')

      // Define folders to track
      const folderConfigs = [
        { name: 'Telegram', key: 'telegram', subPath: 'telegram-data', color: '#0088cc' },
        { name: 'Discord', key: 'discord', subPath: 'discord-data', color: '#5865F2' },
        { name: 'Slack', key: 'slack', subPath: 'slack-data', color: '#611F69' },
        { name: 'MCP Output', key: 'mcpOutput', subPath: 'mcp-output', color: '#F59E0B' },
        { name: 'Agent Output', key: 'agentOutput', subPath: 'agent-output', color: '#8B5CF6' },
        { name: 'Skills', key: 'skills', subPath: 'skills', color: '#10B981' }
      ]

      const folders: StorageFolder[] = []
      let trackedTotal = 0

      // Cache folders to aggregate
      const cacheFolders = ['Cache', 'CachedData', 'Code Cache', 'GPUCache', 'logs']
      let cacheTotal = 0
      for (const folder of cacheFolders) {
        const fullPath = path.join(userDataPath, folder)
        cacheTotal += await getFolderSize(fullPath)
      }
      if (cacheTotal > 0) {
        folders.push({
          name: 'Cache',
          key: 'cache',
          size: cacheTotal,
          color: '#EF4444'
        })
        trackedTotal += cacheTotal
      }

      for (const config of folderConfigs) {
        const fullPath = path.join(userDataPath, config.subPath)
        const size = await getFolderSize(fullPath)
        if (size > 0) {
          folders.push({
            name: config.name,
            key: config.key,
            size,
            color: config.color
          })
          trackedTotal += size
        }
      }

      // Calculate "Other" (temp files, logs, etc.)
      const totalSize = await getFolderSize(userDataPath)
      const otherSize = totalSize - trackedTotal
      if (otherSize > 0) {
        folders.push({
          name: 'Other',
          key: 'other',
          size: otherSize,
          color: '#6B7280'
        })
      }

      return {
        success: true,
        data: {
          total: totalSize,
          folders
        }
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  })

  // Open messages folder for specific platform
  ipcMain.handle(
    'settings:open-messages-folder',
    async (_event, platform?: string): Promise<IpcResponse> => {
      try {
        const platformPaths: Record<string, string> = {
          telegram: 'telegram-data',
          discord: 'discord-data',
          slack: 'slack-data',
          feishu: 'feishu-data'
        }

        let messagesPath: string
        if (platform && platformPaths[platform]) {
          messagesPath = path.join(app.getPath('userData'), platformPaths[platform])
        } else {
          // Open userData folder if no specific platform
          messagesPath = app.getPath('userData')
        }

        // Ensure folder exists
        await fs.mkdir(messagesPath, { recursive: true })
        await shell.openPath(messagesPath)
        return { success: true }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error)
        }
      }
    }
  )

  // Clear cache (temp files, logs, etc.)
  ipcMain.handle('settings:clear-cache', async (): Promise<IpcResponse<number>> => {
    try {
      const userDataPath = app.getPath('userData')
      let clearedSize = 0

      // Folders to clear
      const cacheFolders = ['Cache', 'CachedData', 'Code Cache', 'GPUCache', 'logs']

      for (const folder of cacheFolders) {
        const folderPath = path.join(userDataPath, folder)
        try {
          const size = await getFolderSize(folderPath)
          await fs.rm(folderPath, { recursive: true, force: true })
          clearedSize += size
        } catch {
          // Folder doesn't exist or can't be removed
        }
      }

      // Also clear agent-output folder (generated files)
      const agentOutputPath = path.join(userDataPath, 'agent-output')
      try {
        const size = await getFolderSize(agentOutputPath)
        await fs.rm(agentOutputPath, { recursive: true, force: true })
        await fs.mkdir(agentOutputPath, { recursive: true })
        clearedSize += size
      } catch {
        // Folder doesn't exist or can't be removed
      }

      return { success: true, data: clearedSize }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  })

  // Open DevTools (triggered by clicking version 3 times in dev mode)
  ipcMain.handle('settings:open-devtools', async (): Promise<IpcResponse> => {
    try {
      const { BrowserWindow } = await import('electron')
      const focusedWindow = BrowserWindow.getFocusedWindow()
      if (focusedWindow) {
        focusedWindow.webContents.openDevTools()
        console.log('[Settings] DevTools opened')
        return { success: true }
      }
      return { success: false, error: 'No focused window' }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  })

  // Get logs (for in-app log viewer in production)
  ipcMain.handle('settings:get-logs', async (): Promise<IpcResponse> => {
    try {
      const { loggerService } = await import('../services/logger.service')
      return { 
        success: true, 
        data: {
          logs: loggerService.getLogs(),
          isProduction: loggerService.isProduction()
        }
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  })

  // Clear logs
  ipcMain.handle('settings:clear-logs', async (): Promise<IpcResponse> => {
    try {
      const { loggerService } = await import('../services/logger.service')
      loggerService.clearLogs()
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  })
}
