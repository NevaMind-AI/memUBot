import { ipcMain } from 'electron'
import type { StoredYumiMessage } from '../apps/yumi'
import { yumiBotService } from '../apps/yumi'
import { getMemuApiClient, imApi } from '../services/api'
import { IMSendFileParams, IMSendImageParams } from '../services/api/endpoints/im'
import { getAuthService } from '../services/auth'
import type { AppMessage, BotStatus, IpcResponse } from '../types'

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

  // ============================================
  // User-initiated messages via backend IM API
  // ============================================

  const apiClient = getMemuApiClient()
  const authService = getAuthService()

  // Send a user message (text, image, or file) via backend IM API
  ipcMain.handle(
    'yumi:send-user-message',
    async (
      _event,
      params: {
        type: 'txt' | 'img' | 'file'
        content?: string        // text content (for txt type)
        buffer?: number[]       // file data as byte array (for img/file type)
        filename?: string       // original filename (for img/file type)
        mimeType?: string       // MIME type (for img/file type)
        width?: number          // image width (for img type)
        height?: number         // image height (for img type)
        fileSize?: number       // file size (for file type)
      }
    ): Promise<IpcResponse<{ messageId?: string }>> => {
      try {
        const accessToken = await authService.getAccessToken()
        if (!accessToken) {
          return { success: false, error: 'Not authenticated' }
        }

        const { easemob } = authService.getAuthState()
        if (!easemob?.userId || !easemob?.agentId) {
          return { success: false, error: 'Easemob user/agent info not available' }
        }

        // from = current user, to = bot (agent)
        const from = easemob.userId
        const to = [easemob.agentId]

        // Text message: send directly
        if (params.type === 'txt') {
          if (!params.content) {
            return { success: false, error: 'Content is required for text messages' }
          }
          const result = await imApi.sendMessage(apiClient, accessToken, {
            from,
            to,
            type: 'txt',
            body: { msg: params.content },
            sync_device: true
          })
          return { success: true, data: { messageId: result.message_id } }
        }

        // Image or file message: upload first, then send
        if (!params.buffer || !params.filename) {
          return { success: false, error: 'Buffer and filename are required for image/file messages' }
        }

        const fileBuffer = Buffer.from(params.buffer)
        const uploadResult = await imApi.uploadFile(
          apiClient,
          accessToken,
          fileBuffer,
          params.filename,
          params.mimeType
        )

        if (params.type === 'img') {
          const requestBody = {
            from,
            to,
            type: 'img',
            body: {
              filename: params.filename,
              secret: uploadResult.secret,
              url: uploadResult.url,
              size: params.width && params.height
                ? { width: params.width, height: params.height }
                : undefined
            },
            sync_device: true
          } as IMSendImageParams
          const result = await imApi.sendMessage(apiClient, accessToken, requestBody)
          return { success: true, data: { messageId: result.message_id } }
        }

        // File message
        const requestBody = {
          from,
          to,
          type: 'file',
          body: {
            filename: params.filename,
            secret: uploadResult.secret,
            url: uploadResult.url
          },
          sync_device: true
        } as IMSendFileParams
        const result = await imApi.sendMessage(apiClient, accessToken, requestBody)
        return { success: true, data: { messageId: result.message_id } }
      } catch (error) {
        console.error('[YumiIPC] Failed to send user message:', error)
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error)
        }
      }
    }
  )
}
