import { ipcMain } from 'electron'
import { autoUpdateService } from '../services/auto-update.service'
import type { IpcResponse } from '../types'

/**
 * Setup IPC handlers for auto-update functionality
 */
export function setupUpdaterHandlers(): void {
  // Manual update check (triggered by user from settings/menu)
  ipcMain.handle('updater:check-for-updates', async (): Promise<IpcResponse> => {
    try {
      await autoUpdateService.checkForUpdatesManual()
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  })

  // Get current app version
  ipcMain.handle('updater:get-version', (): IpcResponse<string> => {
    return { success: true, data: autoUpdateService.getVersion() }
  })
}
