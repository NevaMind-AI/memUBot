import { ipcMain, shell } from 'electron'
import * as fs from 'fs/promises'
import { serviceManagerService } from '../services/service-manager.service'

/**
 * Setup IPC handlers for service management
 */
export function setupServiceHandlers(): void {
  // List all services
  ipcMain.handle('service:list', async () => {
    try {
      const services = await serviceManagerService.listServices()
      console.log('[Service IPC] Listing services:', services.length, 'found')
      return { success: true, data: services }
    } catch (error) {
      console.error('[Service IPC] Failed to list services:', error)
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  })

  // Get service info
  ipcMain.handle('service:get', async (_, serviceId: string) => {
    try {
      const service = await serviceManagerService.getService(serviceId)
      if (service) {
        return { success: true, data: service }
      }
      return { success: false, error: 'Service not found' }
    } catch (error) {
      console.error('[Service IPC] Failed to get service:', error)
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  })

  // Start a service (user action enables auto-start)
  ipcMain.handle('service:start', async (_, serviceId: string) => {
    try {
      // When user manually starts, enable auto-start
      const result = await serviceManagerService.startService(serviceId, { enableAutoStart: true })
      return result
    } catch (error) {
      console.error('[Service IPC] Failed to start service:', error)
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  })

  // Stop a service (user action disables auto-start)
  ipcMain.handle('service:stop', async (_, serviceId: string) => {
    try {
      // When user manually stops, disable auto-start
      const result = await serviceManagerService.stopService(serviceId, { disableAutoStart: true })
      return result
    } catch (error) {
      console.error('[Service IPC] Failed to stop service:', error)
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  })

  // Delete a service
  ipcMain.handle('service:delete', async (_, serviceId: string) => {
    try {
      const result = await serviceManagerService.deleteService(serviceId)
      return result
    } catch (error) {
      console.error('[Service IPC] Failed to delete service:', error)
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  })

  // Get services directory path
  ipcMain.handle('service:get-dir', async () => {
    try {
      const dir = serviceManagerService.getServicesDir()
      return { success: true, data: dir }
    } catch (error) {
      console.error('[Service IPC] Failed to get services dir:', error)
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  })

  // Open services directory in file explorer
  ipcMain.handle('service:open-dir', async () => {
    try {
      const dir = serviceManagerService.getServicesDir()
      // Ensure directory exists before opening
      await fs.mkdir(dir, { recursive: true })
      await shell.openPath(dir)
      return { success: true }
    } catch (error) {
      console.error('[Service IPC] Failed to open services dir:', error)
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  })

  console.log('[Service IPC] Handlers registered')
}
