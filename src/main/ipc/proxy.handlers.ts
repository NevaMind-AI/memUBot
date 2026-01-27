import { ipcMain } from 'electron'
import { loadProxyConfig, saveProxyConfig } from '../config/proxy.config'
import type { IpcResponse } from '../types'
import type { ProxyConfig } from '../apps/types'

/**
 * Setup proxy configuration IPC handlers
 */
export function setupProxyHandlers(): void {
  // Get proxy configuration
  ipcMain.handle('proxy:get-config', async (): Promise<IpcResponse<ProxyConfig>> => {
    try {
      const config = await loadProxyConfig()
      return { success: true, data: config }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  })

  // Save proxy configuration
  ipcMain.handle(
    'proxy:save-config',
    async (_event, config: ProxyConfig): Promise<IpcResponse> => {
      try {
        await saveProxyConfig(config)
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
