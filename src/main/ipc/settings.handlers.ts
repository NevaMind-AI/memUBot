import { ipcMain } from 'electron'
import { loadSettings, saveSettings, type AppSettings } from '../config/settings.config'
import type { IpcResponse } from '../types'

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
}
