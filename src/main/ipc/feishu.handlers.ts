import { ipcMain } from 'electron'
import { feishuBotService } from '../apps/feishu'
import type { IpcResponse, BotStatus, AppMessage } from '../types'

/**
 * Setup Feishu-related IPC handlers
 */
export function setupFeishuHandlers(): void {
  // Connect to Feishu
  ipcMain.handle('feishu:connect', async (): Promise<IpcResponse> => {
    try {
      await feishuBotService.connect()
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  })

  // Disconnect from Feishu
  ipcMain.handle('feishu:disconnect', async (): Promise<IpcResponse> => {
    try {
      await feishuBotService.disconnect()
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  })

  // Get bot status
  ipcMain.handle('feishu:status', async (): Promise<IpcResponse<BotStatus>> => {
    try {
      const status = feishuBotService.getStatus()
      return { success: true, data: status }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  })

  // Get all messages
  ipcMain.handle('feishu:get-messages', async (_event, limit?: number): Promise<IpcResponse<AppMessage[]>> => {
    try {
      const messages = await feishuBotService.getMessages(limit)
      return { success: true, data: messages }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  })
}
