import { ipcMain } from 'electron'
import { securityService } from '../services/security.service'

export function setupSecurityHandlers(): void {
  // Generate a new security code
  ipcMain.handle('security:generate-code', async () => {
    try {
      const code = securityService.generateCode()
      return { success: true, data: { code } }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate code'
      }
    }
  })

  // Get current code info (active status, remaining time)
  ipcMain.handle('security:get-code-info', async () => {
    try {
      const info = securityService.getCodeInfo()
      return { success: true, data: info }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get code info'
      }
    }
  })

  // Get all bound users
  ipcMain.handle('security:get-bound-users', async () => {
    try {
      const users = await securityService.getBoundUsers()
      return { success: true, data: users }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get bound users'
      }
    }
  })

  // Remove a bound user
  ipcMain.handle('security:remove-bound-user', async (_, userId: number) => {
    try {
      const removed = await securityService.removeBoundUser(userId)
      return { success: true, data: { removed } }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to remove user'
      }
    }
  })

  // Clear all bound users
  ipcMain.handle('security:clear-bound-users', async () => {
    try {
      await securityService.clearAllBoundUsers()
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to clear users'
      }
    }
  })
}
