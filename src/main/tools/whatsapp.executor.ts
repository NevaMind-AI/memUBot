import { whatsappBotService } from '../apps/whatsapp/bot.service'
import { whatsappStorage } from '../apps/whatsapp/storage'
import { appEvents } from '../events'

type ToolResult = { success: boolean; data?: unknown; error?: string }

/**
 * Get the current chat ID
 */
function getCurrentChatId(): string | null {
  return whatsappBotService.getCurrentChatId()
}

// ========== Tool Executors ==========

interface SendTextInput {
  text: string
}

export async function executeWhatsAppSendText(input: SendTextInput): Promise<ToolResult> {
  const chatId = getCurrentChatId()
  if (!chatId) {
    return { success: false, error: 'No active WhatsApp chat. User must send a message first.' }
  }

  const result = await whatsappBotService.sendText(chatId, input.text)

  if (result.success) {
    return { success: true, data: { messageId: result.messageId } }
  }
  return { success: false, error: result.error }
}

interface SendImageInput {
  image: string
  caption?: string
}

export async function executeWhatsAppSendImage(input: SendImageInput): Promise<ToolResult> {
  const chatId = getCurrentChatId()
  if (!chatId) {
    return { success: false, error: 'No active WhatsApp chat. User must send a message first.' }
  }

  const result = await whatsappBotService.sendImage(chatId, input.image, input.caption)

  if (result.success) {
    return { success: true, data: { messageId: result.messageId } }
  }
  return { success: false, error: result.error }
}

interface SendDocumentInput {
  document: string
  filename?: string
}

export async function executeWhatsAppSendDocument(input: SendDocumentInput): Promise<ToolResult> {
  const chatId = getCurrentChatId()
  if (!chatId) {
    return { success: false, error: 'No active WhatsApp chat. User must send a message first.' }
  }

  const result = await whatsappBotService.sendDocument(chatId, input.document, input.filename)

  if (result.success) {
    return { success: true, data: { messageId: result.messageId } }
  }
  return { success: false, error: result.error }
}

interface SendLocationInput {
  latitude: number
  longitude: number
  description?: string
}

export async function executeWhatsAppSendLocation(input: SendLocationInput): Promise<ToolResult> {
  const chatId = getCurrentChatId()
  if (!chatId) {
    return { success: false, error: 'No active WhatsApp chat. User must send a message first.' }
  }

  const result = await whatsappBotService.sendLocation(
    chatId,
    input.latitude,
    input.longitude,
    input.description
  )

  if (result.success) {
    return { success: true, data: { messageId: result.messageId } }
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
export async function executeWhatsAppDeleteChatHistory(
  input: DeleteChatHistoryInput
): Promise<ToolResult> {
  try {
    let deletedCount = 0

    switch (input.mode) {
      case 'count': {
        if (!input.count || input.count <= 0) {
          return { success: false, error: 'count must be a positive number' }
        }
        deletedCount = await whatsappStorage.deleteRecentMessages(input.count)
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
        
        console.log(`[WhatsApp] Deleting messages from ${startDate.toISOString()} to ${endDate.toISOString()}`)
        deletedCount = await whatsappStorage.deleteMessagesByTimeRange(startDate, endDate)
        break
      }
      case 'all': {
        const totalCount = await whatsappStorage.getMessageCount()
        await whatsappStorage.clearMessages()
        deletedCount = totalCount
        break
      }
      default:
        return { success: false, error: `Unknown mode: ${input.mode}. Use 'count', 'time_range', or 'all'` }
    }

    // Emit refresh event to update UI
    appEvents.emitMessagesRefresh('whatsapp')

    return {
      success: true,
      data: {
        deleted_count: deletedCount,
        message: `Successfully deleted ${deletedCount} message(s). Chat history refreshed.`
      }
    }
  } catch (error) {
    console.error('[WhatsApp] Delete chat history error:', error)
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

/**
 * Execute a WhatsApp tool by name
 */
export async function executeWhatsAppTool(name: string, input: unknown): Promise<ToolResult> {
  switch (name) {
    case 'whatsapp_send_text':
      return await executeWhatsAppSendText(input as SendTextInput)
    case 'whatsapp_send_image':
      return await executeWhatsAppSendImage(input as SendImageInput)
    case 'whatsapp_send_document':
      return await executeWhatsAppSendDocument(input as SendDocumentInput)
    case 'whatsapp_send_location':
      return await executeWhatsAppSendLocation(input as SendLocationInput)
    case 'whatsapp_delete_chat_history':
      return await executeWhatsAppDeleteChatHistory(input as DeleteChatHistoryInput)
    default:
      return { success: false, error: `Unknown WhatsApp tool: ${name}` }
  }
}
