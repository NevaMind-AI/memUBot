import { ipcMain } from 'electron'
import { whatsappBotService } from '../apps/whatsapp'
import { securityService } from '../services/security.service'
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

  // Security code handlers
  ipcMain.handle('whatsapp:generateCode', async () => {
    return securityService.generateCode()
  })

  ipcMain.handle('whatsapp:getCurrentCode', async () => {
    return securityService.getCurrentCode()
  })

  ipcMain.handle('whatsapp:bindUser', async (_event, code: string, userData: any) => {
    return securityService.bindUser('whatsapp', code, userData)
  })

  ipcMain.handle('whatsapp:getBoundUsers', async () => {
    return securityService.getBoundUsers('whatsapp')
  })

  ipcMain.handle('whatsapp:isUserBound', async (_event, uniqueId: string) => {
    return securityService.isUserBound('whatsapp', uniqueId)
  })

  ipcMain.handle('whatsapp:unbindUser', async (_event, uniqueId: string) => {
    return securityService.unbindUser('whatsapp', uniqueId)
  })

  console.log('[IPC] WhatsApp handlers registered')
}
