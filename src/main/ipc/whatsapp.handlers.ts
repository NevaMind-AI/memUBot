import { ipcMain } from 'electron'
import { whatsappBotService } from '../apps/whatsapp'
import type { IpcResponse, AppMessage, BotStatus } from '../types'

/**
 * Setup IPC handlers for WhatsApp bot
 */
export function setupWhatsAppHandlers(): void {
  // Connect to WhatsApp
  ipcMain.handle('whatsapp:connect', async (): Promise<IpcResponse> => {
    try {
      await whatsappBotService.connect()
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  })

  // Disconnect from WhatsApp
  ipcMain.handle('whatsapp:disconnect', async (): Promise<IpcResponse> => {
    try {
      await whatsappBotService.disconnect()
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  })

  // Get WhatsApp bot status
  ipcMain.handle('whatsapp:status', (): IpcResponse<BotStatus> => {
    try {
      const status = whatsappBotService.getStatus()
      return { success: true, data: status }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  })

  // Get QR code for authentication
  ipcMain.handle('whatsapp:get-qr', (): IpcResponse<string | undefined> => {
    try {
      const qrCode = whatsappBotService.getQRCode()
      return { success: true, data: qrCode }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  })

  // Get messages (single-user mode)
  ipcMain.handle(
    'whatsapp:get-messages',
    async (_event, limit?: number): Promise<IpcResponse<AppMessage[]>> => {
      try {
        const messages = await whatsappBotService.getMessages(limit)
        return { success: true, data: messages }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error)
        }
      }
    }
  )

  console.log('[IPC] WhatsApp handlers registered')
}
