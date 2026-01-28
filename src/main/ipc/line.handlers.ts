import { ipcMain } from 'electron'
import { lineBotService } from '../apps/line'
import type { IpcResponse, AppMessage, BotStatus } from '../types'

/**
 * Setup IPC handlers for Line bot
 */
export function setupLineHandlers(): void {
  // Connect to Line
  ipcMain.handle('line:connect', async (): Promise<IpcResponse> => {
    try {
      await lineBotService.connect()
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  })

  // Disconnect from Line
  ipcMain.handle('line:disconnect', async (): Promise<IpcResponse> => {
    try {
      await lineBotService.disconnect()
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  })

  // Get Line bot status
  ipcMain.handle('line:status', (): IpcResponse<BotStatus> => {
    try {
      const status = lineBotService.getStatus()
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
    'line:get-messages',
    async (_event, limit?: number): Promise<IpcResponse<AppMessage[]>> => {
      try {
        const messages = await lineBotService.getMessages(limit)
        return { success: true, data: messages }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error)
        }
      }
    }
  )

  console.log('[IPC] Line handlers registered')
}
