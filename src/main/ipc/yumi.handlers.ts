import { ipcMain } from 'electron'
import { yumiBotService, convertToAppMessage } from '../apps/yumi'
import type { StoredYumiMessage } from '../apps/yumi'
import type { IpcResponse, AppMessage, BotStatus } from '../types'

/**
 * Setup Yumi-related IPC handlers
 *
 * Unlike other platforms where the main process receives messages directly,
 * Yumi messages arrive via Easemob SDK in the renderer. The renderer forwards
 * them here for storage and agent processing.
 *
 * Message Flow:
 * 1. renderer: Easemob SDK receives message
 * 2. renderer -> main: yumi:store-message
 * 3. main: yumiBotService.processIncomingMessage() -> agentService
 * 4. main -> renderer: yumi:send-message (for agent reply)
 * 5. renderer: Easemob SDK sends the reply
 */
export async function setupYumiHandlers(): Promise<void> {
  // Initialize the bot service
  await yumiBotService.initialize()

  // Get bot status
  ipcMain.handle('yumi:status', async (): Promise<BotStatus> => {
    return yumiBotService.getStatus()
  })

  // Get stored messages (history)
  ipcMain.handle(
    'yumi:get-messages',
    async (_event, limit?: number): Promise<IpcResponse<AppMessage[]>> => {
      try {
        const messages = await yumiBotService.getMessages(limit)
        return { success: true, data: messages }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error)
        }
      }
    }
  )

  // Receive a message from renderer (Easemob SDK) for processing
  // This handles: storage, agent processing, and reply sending
  // The message may include an attachment with buffer data for image/file/audio/video
  ipcMain.handle(
    'yumi:store-message',
    async (_event, message: StoredYumiMessage & {
      attachment?: {
        url: string
        filename: string
        mimeType?: string
        size?: number
        width?: number
        height?: number
        thumb?: string
        buffer?: number[]
      }
    }): Promise<IpcResponse> => {
      try {
        // Extract attachment data before passing to service
        const { attachment, ...msgData } = message

        // Let the bot service handle everything (store with attachment, process, reply)
        await yumiBotService.processIncomingMessage(msgData, attachment)
        return { success: true }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error)
        }
      }
    }
  )

  // Update connection status from renderer
  ipcMain.handle(
    'yumi:connection-status',
    async (_event, isConnected: boolean, error?: string): Promise<IpcResponse> => {
      try {
        yumiBotService.updateConnectionStatus(isConnected, error)
        return { success: true }
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : String(err)
        }
      }
    }
  )

  // Send a text message (called from main process internals, not renderer)
  // Renderer uses yumi:send-message IPC for this
  ipcMain.handle(
    'yumi:send-text',
    async (
      _event,
      targetUserId: string,
      text: string
    ): Promise<IpcResponse<{ messageId?: string }>> => {
      try {
        const result = await yumiBotService.sendText(targetUserId, text)
        if (result.success) {
          return { success: true, data: { messageId: result.messageId } }
        }
        return { success: false, error: result.error }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error)
        }
      }
    }
  )
}
