import { ipcMain } from 'electron'
import { securityService, type Platform } from '../services/security.service'

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

  // Get bound users for a specific platform (or all if not specified)
  ipcMain.handle('security:get-bound-users', async (_, platform?: Platform) => {
    try {
      const users = await securityService.getBoundUsers(platform)
      return { success: true, data: users }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get bound users'
      }
    }
  })

  // Remove a bound user from a specific platform
  ipcMain.handle(
    'security:remove-bound-user',
    async (_, userId: number, platform: Platform = 'telegram') => {
      try {
        const removed = await securityService.removeBoundUser(userId, platform)
        return { success: true, data: { removed } }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to remove user'
        }
      }
    }
  )

  // Remove a bound user by string ID (for Discord)
  ipcMain.handle(
    'security:remove-bound-user-by-id',
    async (_, uniqueId: string, platform: Platform) => {
      try {
        const removed = await securityService.removeBoundUserByStringId(uniqueId, platform)
        return { success: true, data: { removed } }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to remove user'
        }
      }
    }
  )

  // Clear bound users for a specific platform (or all if not specified)
  ipcMain.handle('security:clear-bound-users', async (_, platform?: Platform) => {
    try {
      await securityService.clearBoundUsers(platform)
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to clear users'
      }
    }
  })
}
