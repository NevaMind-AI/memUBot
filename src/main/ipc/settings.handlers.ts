import { ipcMain, app } from 'electron'
import * as fs from 'fs/promises'
import * as path from 'path'
import { loadSettings, saveSettings, type AppSettings } from '../config/settings.config'
import { mcpService } from '../services/mcp.service'
import type { IpcResponse } from '../types'

/**
 * MCP Server Configuration Type
 */
interface McpServerConfig {
  [key: string]: {
    command: string
    args?: string[]
    env?: Record<string, string>
    disabled?: boolean
  }
}

/**
 * Get the path to the MCP config file
 */
function getMcpConfigPath(): string {
  return path.join(app.getPath('userData'), 'mcp-config.json')
}

/**
 * Load MCP configuration
 */
async function loadMcpConfig(): Promise<McpServerConfig> {
  try {
    const configPath = getMcpConfigPath()
    const content = await fs.readFile(configPath, 'utf-8')
    return JSON.parse(content)
  } catch {
    return {}
  }
}

/**
 * Save MCP configuration
 */
async function saveMcpConfig(config: McpServerConfig): Promise<void> {
  const configPath = getMcpConfigPath()
  await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8')
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
        await saveSettings(updates)
        return { success: true }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error)
        }
      }
    }
  )

  // Get MCP configuration
  ipcMain.handle('settings:get-mcp-config', async (): Promise<IpcResponse<McpServerConfig>> => {
    try {
      const config = await loadMcpConfig()
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
}
