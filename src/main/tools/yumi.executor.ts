import * as fs from 'fs'
import * as path from 'path'
import { yumiBotService } from '../apps/yumi/bot.service'
import { yumiStorage } from '../apps/yumi/storage'
import { appEvents } from '../events'

type ToolResult = { success: boolean; data?: unknown; error?: string }

/**
 * Get the current target user ID for replies
 */
function getCurrentTargetUserId(): string | null {
  return yumiBotService.getCurrentTargetUserId()
}

/**
 * Check if a string is a URL
 */
function isUrl(str: string): boolean {
  return str.startsWith('http://') || str.startsWith('https://')
}

/**
 * Check if a string is a file:// URL
 */
function isFileUrl(str: string): boolean {
  return str.startsWith('file://')
}

/**
 * Convert file:// URL to path
 */
function fileUrlToPath(fileUrl: string): string {
  // Remove file:// prefix and decode URI components
  return decodeURIComponent(fileUrl.replace('file://', ''))
}

/**
 * Resolve file path and read content
 * Returns file buffer for local files, or URL string for remote URLs
 */
interface ResolvedFile {
  type: 'buffer' | 'url'
  buffer?: Buffer
  url?: string
  filename: string
  mimeType?: string
  size?: number
}

function resolveFile(filePath: string): ResolvedFile {
  // Handle HTTP/HTTPS URLs - pass through
  if (isUrl(filePath)) {
    return {
      type: 'url',
      url: filePath,
      filename: path.basename(new URL(filePath).pathname) || 'file'
    }
  }

  // Handle file:// URLs
  let actualPath = filePath
  if (isFileUrl(filePath)) {
    actualPath = fileUrlToPath(filePath)
  }

  // Expand ~ to home directory
  if (actualPath.startsWith('~')) {
    actualPath = actualPath.replace(/^~/, process.env.HOME || '')
  }

  // Resolve absolute path
  const absolutePath = path.isAbsolute(actualPath) ? actualPath : path.resolve(actualPath)

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`File not found: ${absolutePath}`)
  }

  const stats = fs.statSync(absolutePath)
  const buffer = fs.readFileSync(absolutePath)
  const filename = path.basename(absolutePath)
  const ext = path.extname(absolutePath).toLowerCase()

  // Determine MIME type
  const mimeTypes: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.bmp': 'image/bmp',
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.txt': 'text/plain',
    '.zip': 'application/zip'
  }

  return {
    type: 'buffer',
    buffer,
    filename,
    mimeType: mimeTypes[ext] || 'application/octet-stream',
    size: stats.size
  }
}

// ========== Tool Executors ==========

interface SendTextInput {
  text: string
}

export async function executeYumiSendText(input: SendTextInput): Promise<ToolResult> {
  const targetUserId = getCurrentTargetUserId()
  if (!targetUserId) {
    return { success: false, error: 'No active Yumi chat. User must send a message first.' }
  }

  const result = await yumiBotService.sendText(targetUserId, input.text)

  if (result.success) {
    return { success: true, data: { sent: true, messageId: result.messageId } }
  }
  return { success: false, error: result.error }
}

interface SendImageInput {
  image: string
  filename?: string
  width?: number
  height?: number
}

export async function executeYumiSendImage(input: SendImageInput): Promise<ToolResult> {
  const targetUserId = getCurrentTargetUserId()
  if (!targetUserId) {
    return { success: false, error: 'No active Yumi chat. User must send a message first.' }
  }

  try {
    const resolved = resolveFile(input.image)

    if (resolved.type === 'buffer' && resolved.buffer) {
      // Local file - send buffer with metadata
      const result = await yumiBotService.sendImage(targetUserId, {
        type: 'buffer',
        buffer: resolved.buffer,
        filename: input.filename || resolved.filename,
        mimeType: resolved.mimeType,
        size: resolved.size,
        width: input.width,
        height: input.height
      })

      if (result.success) {
        return { success: true, data: { sent: true, messageId: result.messageId } }
      }
      return { success: false, error: result.error }
    } else {
      // Remote URL - pass through
      const result = await yumiBotService.sendImage(targetUserId, {
        type: 'url',
        url: resolved.url!,
        filename: input.filename || resolved.filename,
        width: input.width,
        height: input.height
      })

      if (result.success) {
        return { success: true, data: { sent: true, messageId: result.messageId } }
      }
      return { success: false, error: result.error }
    }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

interface SendFileInput {
  file: string
  filename?: string
  file_size?: number
}

export async function executeYumiSendFile(input: SendFileInput): Promise<ToolResult> {
  const targetUserId = getCurrentTargetUserId()
  if (!targetUserId) {
    return { success: false, error: 'No active Yumi chat. User must send a message first.' }
  }

  try {
    const resolved = resolveFile(input.file)

    if (resolved.type === 'buffer' && resolved.buffer) {
      // Local file - send buffer with metadata
      const result = await yumiBotService.sendFile(targetUserId, {
        type: 'buffer',
        buffer: resolved.buffer,
        filename: input.filename || resolved.filename,
        mimeType: resolved.mimeType,
        size: resolved.size || input.file_size
      })

      if (result.success) {
        return { success: true, data: { sent: true, messageId: result.messageId } }
      }
      return { success: false, error: result.error }
    } else {
      // Remote URL - pass through
      const result = await yumiBotService.sendFile(targetUserId, {
        type: 'url',
        url: resolved.url!,
        filename: input.filename || resolved.filename,
        size: input.file_size
      })

      if (result.success) {
        return { success: true, data: { sent: true, messageId: result.messageId } }
      }
      return { success: false, error: result.error }
    }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

/**
 * Input for delete chat history tool
 */
interface DeleteChatHistoryInput {
  mode: 'count' | 'time_range' | 'all'
  count?: number
  start_datetime?: string
  end_datetime?: string
}

/**
 * Parse datetime string to Date object
 * Supports ISO 8601 with timezone, 'now', or date-only format
 */
function parseDatetime(datetimeStr: string): Date {
  if (datetimeStr.toLowerCase() === 'now') {
    return new Date()
  }

  // If it's a date-only format (YYYY-MM-DD), append local timezone
  if (/^\d{4}-\d{2}-\d{2}$/.test(datetimeStr)) {
    return new Date(datetimeStr + 'T00:00:00')
  }

  // If it has time but no timezone, assume local time
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(datetimeStr)) {
    return new Date(datetimeStr)
  }

  // Full ISO 8601 with timezone
  return new Date(datetimeStr)
}

/**
 * Delete chat history
 */
export async function executeYumiDeleteChatHistory(
  input: DeleteChatHistoryInput
): Promise<ToolResult> {
  try {
    let deletedCount = 0

    switch (input.mode) {
      case 'count': {
        if (!input.count || input.count <= 0) {
          return { success: false, error: 'count must be a positive number' }
        }
        deletedCount = await yumiStorage.deleteRecentMessages(input.count)
        break
      }
      case 'time_range': {
        const startStr = input.start_datetime
        const endStr = input.end_datetime

        if (!startStr || !endStr) {
          return {
            success: false,
            error: 'start_datetime and end_datetime are required for time_range mode'
          }
        }

        const startDate = parseDatetime(startStr)
        const endDate = parseDatetime(endStr)

        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
          return {
            success: false,
            error: 'Invalid datetime format. Use ISO 8601 format like 2026-02-04T22:00:00+08:00'
          }
        }

        console.log(
          `[Yumi] Deleting messages from ${startDate.toISOString()} to ${endDate.toISOString()}`
        )
        deletedCount = await yumiStorage.deleteMessagesByTimeRange(startDate, endDate)
        break
      }
      case 'all': {
        const totalCount = await yumiStorage.getTotalMessageCount()
        await yumiStorage.clearMessages()
        deletedCount = totalCount
        break
      }
      default:
        return {
          success: false,
          error: `Unknown mode: ${input.mode}. Use 'count', 'time_range', or 'all'`
        }
    }

    // Emit refresh event to update UI
    appEvents.emitMessagesRefresh('yumi')

    return {
      success: true,
      data: {
        deleted_count: deletedCount,
        message: `Successfully deleted ${deletedCount} message(s). Chat history refreshed.`
      }
    }
  } catch (error) {
    console.error('[Yumi] Delete chat history error:', error)
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

/**
 * Execute a Yumi tool by name
 */
export async function executeYumiTool(name: string, input: unknown): Promise<ToolResult> {
  switch (name) {
    case 'yumi_send_text':
      return await executeYumiSendText(input as SendTextInput)
    case 'yumi_send_image':
      return await executeYumiSendImage(input as SendImageInput)
    case 'yumi_send_file':
      return await executeYumiSendFile(input as SendFileInput)
    case 'yumi_delete_chat_history':
      return await executeYumiDeleteChatHistory(input as DeleteChatHistoryInput)
    default:
      return { success: false, error: `Unknown Yumi tool: ${name}` }
  }
}
