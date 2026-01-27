import { ipcMain, BrowserWindow } from 'electron'
import { tailscaleService, type TailscaleStatus } from '../services/tailscale.service'

export function setupTailscaleHandlers(): void {
  // Get Tailscale status
  ipcMain.handle('tailscale:get-status', async () => {
    try {
      const status = await tailscaleService.getStatus()
      return { success: true, data: status }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get status'
      }
    }
  })

  // Connect/Start Tailscale
  ipcMain.handle('tailscale:connect', async () => {
    try {
      const result = await tailscaleService.start()
      return result
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to connect'
      }
    }
  })

  // Disconnect/Stop Tailscale
  ipcMain.handle('tailscale:disconnect', async () => {
    try {
      const result = await tailscaleService.stop()
      return result
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to disconnect'
      }
    }
  })

  // Login to Tailscale
  ipcMain.handle('tailscale:login', async () => {
    try {
      const result = await tailscaleService.login()
      return result
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to login'
      }
    }
  })

  // Logout from Tailscale
  ipcMain.handle('tailscale:logout', async () => {
    try {
      const result = await tailscaleService.logout()
      return result
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to logout'
      }
    }
  })

  // Ping a peer
  ipcMain.handle('tailscale:ping', async (_, target: string) => {
    try {
      const result = await tailscaleService.ping(target)
      return result
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Ping failed'
      }
    }
  })
}

// Start status polling and emit to renderer
export function startTailscaleStatusPolling(mainWindow: BrowserWindow): () => void {
  const unsubscribe = tailscaleService.onStatusChange((status: TailscaleStatus) => {
    mainWindow.webContents.send('tailscale:status-changed', status)
  })

  const stopPolling = tailscaleService.startStatusPolling(10000) // Poll every 10 seconds

  return () => {
    unsubscribe()
    stopPolling()
  }
}
