import { ipcMain } from 'electron'
import { telegramBotService } from '../apps/telegram'
import type { IpcResponse, BotStatus, AppMessage } from '../types'

/**
 * Setup Telegram-related IPC handlers
 */
export function setupTelegramHandlers(): void {
  // Connect to Telegram
  ipcMain.handle('telegram:connect', async (): Promise<IpcResponse> => {
    try {
      await telegramBotService.connect()
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  })

  // Disconnect from Telegram
  ipcMain.handle('telegram:disconnect', async (): Promise<IpcResponse> => {
    try {
      await telegramBotService.disconnect()
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  })

  // Get bot status
  ipcMain.handle('telegram:status', async (): Promise<IpcResponse<BotStatus>> => {
    try {
      const status = telegramBotService.getStatus()
      return { success: true, data: status }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  })

  // Get all messages (single-user mode)
  ipcMain.handle('telegram:get-messages', async (_event, limit?: number): Promise<IpcResponse<AppMessage[]>> => {
    try {
      const messages = await telegramBotService.getMessages(limit)
      return { success: true, data: messages }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  })
}
