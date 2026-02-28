import { ipcMain } from 'electron'
import { discordBotService } from '../apps/discord/bot.service'
import type { IpcResponse, AppMessage, BotStatus } from '../types'

/**
 * Setup IPC handlers for Discord bot
 */
export function setupDiscordHandlers(): void {
  // Connect to Discord
  ipcMain.handle('discord:connect', async (): Promise<IpcResponse> => {
    try {
      await discordBotService.connect()
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  })

  // Disconnect from Discord
  ipcMain.handle('discord:disconnect', async (): Promise<IpcResponse> => {
    try {
      await discordBotService.disconnect()
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  })

  // Get Discord bot status
  ipcMain.handle('discord:status', (): IpcResponse<BotStatus> => {
    try {
      const status = discordBotService.getStatus()
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
    'discord:get-messages',
    async (_event, limit?: number): Promise<IpcResponse<AppMessage[]>> => {
      try {
        const messages = await discordBotService.getMessages(limit)
        return { success: true, data: messages }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error)
        }
      }
    }
  )

  console.log('[IPC] Discord handlers registered')
}
