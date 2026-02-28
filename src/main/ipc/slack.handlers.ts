import { ipcMain } from 'electron'
import { slackBotService } from '../apps/slack'
import type { IpcResponse, AppMessage, BotStatus } from '../types'

/**
 * Setup IPC handlers for Slack bot
 */
export function setupSlackHandlers(): void {
  // Connect to Slack
  ipcMain.handle('slack:connect', async (): Promise<IpcResponse> => {
    try {
      await slackBotService.connect()
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  })

  // Disconnect from Slack
  ipcMain.handle('slack:disconnect', async (): Promise<IpcResponse> => {
    try {
      await slackBotService.disconnect()
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  })

  // Get Slack bot status
  ipcMain.handle('slack:status', (): IpcResponse<BotStatus> => {
    try {
      const status = slackBotService.getStatus()
      return { success: true, data: status }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  })

  // Get messages (single-user mode)
  ipcMain.handle(
    'slack:get-messages',
    async (_event, limit?: number): Promise<IpcResponse<AppMessage[]>> => {
      try {
        const messages = await slackBotService.getMessages(limit)
        return { success: true, data: messages }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error)
        }
      }
    }
  )

  console.log('[IPC] Slack handlers registered')
}
