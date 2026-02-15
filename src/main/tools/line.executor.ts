import { lineBotService } from '../apps/line/bot.service'
import { lineStorage } from '../apps/line/storage'
import { appEvents } from '../events'

type ToolResult = { success: boolean; data?: unknown; error?: string }

/**
 * Get the current source ID (user/group/room)
 */
function getCurrentSourceId(): string | null {
  const source = lineBotService.getCurrentSource()
  return source.id
}

// ========== Tool Executors ==========

interface SendTextInput {
  text: string
  /** @internal Used by sendIntentSummaryToUser to skip storage */
  _storeInHistory?: boolean
}

export async function executeLineSendText(input: SendTextInput): Promise<ToolResult> {
  const sourceId = getCurrentSourceId()
  if (!sourceId) {
    return { success: false, error: 'No active Line chat. User must send a message first.' }
  }

  const result = await lineBotService.sendText(sourceId, input.text)

  if (result.success) {
    return { success: true, data: { sent: true } }
  }
  return { success: false, error: result.error }
}

interface SendImageInput {
  original_url: string
  preview_url: string
}

export async function executeLineSendImage(input: SendImageInput): Promise<ToolResult> {
  const sourceId = getCurrentSourceId()
  if (!sourceId) {
    return { success: false, error: 'No active Line chat. User must send a message first.' }
  }

  const result = await lineBotService.sendImage(sourceId, input.original_url, input.preview_url)

  if (result.success) {
    return { success: true, data: { sent: true } }
  }
  return { success: false, error: result.error }
}

interface SendStickerInput {
  package_id: string
  sticker_id: string
}

export async function executeLineSendSticker(input: SendStickerInput): Promise<ToolResult> {
  const sourceId = getCurrentSourceId()
  if (!sourceId) {
    return { success: false, error: 'No active Line chat. User must send a message first.' }
  }

  const result = await lineBotService.sendSticker(sourceId, input.package_id, input.sticker_id)

  if (result.success) {
    return { success: true, data: { sent: true } }
  }
  return { success: false, error: result.error }
}

interface SendLocationInput {
  title: string
  address: string
  latitude: number
  longitude: number
}

export async function executeLineSendLocation(input: SendLocationInput): Promise<ToolResult> {
  const sourceId = getCurrentSourceId()
  if (!sourceId) {
    return { success: false, error: 'No active Line chat. User must send a message first.' }
  }

  const result = await lineBotService.sendLocation(
    sourceId,
    input.title,
    input.address,
    input.latitude,
    input.longitude
  )

  if (result.success) {
    return { success: true, data: { sent: true } }
  }
  return { success: false, error: result.error }
}

interface SendFlexInput {
  alt_text: string
  contents: unknown
}

export async function executeLineSendFlex(input: SendFlexInput): Promise<ToolResult> {
  const sourceId = getCurrentSourceId()
  if (!sourceId) {
    return { success: false, error: 'No active Line chat. User must send a message first.' }
  }

  const result = await lineBotService.sendFlexMessage(sourceId, input.alt_text, input.contents)

  if (result.success) {
    return { success: true, data: { sent: true } }
  }
  return { success: false, error: result.error }
}

/**
 * Input for delete chat history tool
 */
interface DeleteChatHistoryInput {
  mode: 'count' | 'time_range' | 'all'
  count?: number
  start_datetime?: string // ISO 8601 datetime with timezone
  end_datetime?: string   // ISO 8601 datetime with timezone, or 'now'
  // Legacy support
  start_date?: string
  end_date?: string
}

/**
 * Parse datetime string to Date object
 * Supports ISO 8601 with timezone, 'now', or legacy date-only format
 */
function parseDatetime(datetimeStr: string): Date {
  if (datetimeStr.toLowerCase() === 'now') {
    return new Date()
  }
  
  // If it's a date-only format (YYYY-MM-DD), append local timezone
  if (/^\d{4}-\d{2}-\d{2}$/.test(datetimeStr)) {
    // Parse as local time by appending T00:00:00
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
export async function executeLineDeleteChatHistory(
  input: DeleteChatHistoryInput
): Promise<ToolResult> {
  try {
    let deletedCount = 0

    switch (input.mode) {
      case 'count': {
        if (!input.count || input.count <= 0) {
          return { success: false, error: 'count must be a positive number' }
        }
        deletedCount = await lineStorage.deleteRecentMessages(input.count)
        break
      }
      case 'time_range': {
        // Support both new (start_datetime/end_datetime) and legacy (start_date/end_date) params
        const startStr = input.start_datetime || input.start_date
        const endStr = input.end_datetime || input.end_date
        
        if (!startStr || !endStr) {
          return { success: false, error: 'start_datetime and end_datetime are required for time_range mode' }
        }
        
        const startDate = parseDatetime(startStr)
        const endDate = parseDatetime(endStr)
        
        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
          return { success: false, error: 'Invalid datetime format. Use ISO 8601 format like 2026-02-04T22:00:00+08:00' }
        }
        
        console.log(`[Line] Deleting messages from ${startDate.toISOString()} to ${endDate.toISOString()}`)
        deletedCount = await lineStorage.deleteMessagesByTimeRange(startDate, endDate)
        break
      }
      case 'all': {
        const totalCount = await lineStorage.getMessageCount()
        await lineStorage.clearMessages()
        deletedCount = totalCount
        break
      }
      default:
        return { success: false, error: `Unknown mode: ${input.mode}. Use 'count', 'time_range', or 'all'` }
    }

    // Emit refresh event to update UI
    appEvents.emitMessagesRefresh('line')

    return {
      success: true,
      data: {
        deleted_count: deletedCount,
        message: `Successfully deleted ${deletedCount} message(s). Chat history refreshed.`
      }
    }
  } catch (error) {
    console.error('[Line] Delete chat history error:', error)
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

/**
 * Execute a Line tool by name
 */
export async function executeLineTool(name: string, input: unknown): Promise<ToolResult> {
  switch (name) {
    case 'line_send_text':
      return await executeLineSendText(input as SendTextInput)
    case 'line_send_image':
      return await executeLineSendImage(input as SendImageInput)
    case 'line_send_sticker':
      return await executeLineSendSticker(input as SendStickerInput)
    case 'line_send_location':
      return await executeLineSendLocation(input as SendLocationInput)
    case 'line_send_flex':
      return await executeLineSendFlex(input as SendFlexInput)
    case 'line_delete_chat_history':
      return await executeLineDeleteChatHistory(input as DeleteChatHistoryInput)
    default:
      return { success: false, error: `Unknown Line tool: ${name}` }
  }
}
