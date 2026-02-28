import * as fs from 'fs'
import * as path from 'path'
import { feishuBotService } from '../apps/feishu/bot.service'
import { feishuStorage } from '../apps/feishu/storage'
import { appEvents } from '../events'
import type { StoredFeishuMessage, StoredFeishuAttachment } from '../apps/feishu/types'

type ToolResult = { success: boolean; data?: unknown; error?: string }

/**
 * Store a sent message and emit event to update UI
 */
async function storeSentMessage(
  messageId: string,
  chatId: string,
  text?: string,
  attachments?: StoredFeishuAttachment[]
): Promise<void> {
  const status = feishuBotService.getStatus()
  
  const storedMessage: StoredFeishuMessage = {
    messageId,
    chatId,
    chatType: 'p2p',
    fromId: 'bot',
    fromName: status.botName || 'Bot',
    text,
    attachments,
    date: Math.floor(Date.now() / 1000),
    isFromBot: true
  }

  await feishuStorage.storeMessage(storedMessage)

  appEvents.emitFeishuNewMessage({
    id: messageId,
    platform: 'feishu',
    chatId,
    senderId: 'bot',
    senderName: status.botName || 'Bot',
    content: text || '',
    attachments: attachments?.map((att) => ({
      id: att.id,
      name: att.name,
      url: att.url,
      contentType: att.contentType,
      size: att.size || 0,
      width: att.width,
      height: att.height
    })),
    timestamp: new Date(),
    isFromBot: true
  })
}

/**
 * Get the current chat ID
 */
function getCurrentChatId(): string | null {
  return feishuBotService.getCurrentChatId()
}

/**
 * Expand ~ to home directory and resolve to absolute path
 */
function expandPath(filePath: string): string {
  let expanded = filePath
  if (filePath.startsWith('~')) {
    expanded = filePath.replace(/^~/, process.env.HOME || '')
  }
  return path.isAbsolute(expanded) ? expanded : path.resolve(expanded)
}

/**
 * Check if a path exists
 */
function fileExists(filePath: string): boolean {
  const absolutePath = expandPath(filePath)
  return fs.existsSync(absolutePath)
}

/**
 * Get file size from local path
 */
function getFileSize(filePath: string): number {
  try {
    const absolutePath = expandPath(filePath)
    const stats = fs.statSync(absolutePath)
    return stats.size
  } catch {
    return 0
  }
}

// ========== Tool Executors ==========

interface SendTextInput {
  text: string
  /** @internal Used by sendIntentSummaryToUser to skip storage */
  _storeInHistory?: boolean
}

export async function executeFeishuSendText(input: SendTextInput): Promise<ToolResult> {
  const chatId = getCurrentChatId()
  if (!chatId) {
    return { success: false, error: 'No active Feishu chat. User must send a message first.' }
  }

  const shouldStore = input._storeInHistory !== false
  const result = await feishuBotService.sendText(chatId, input.text, { storeInHistory: shouldStore })

  if (result.success && result.messageId) {
    if (shouldStore) {
      await storeSentMessage(result.messageId, chatId, input.text)
    }
    return { success: true, data: { messageId: result.messageId } }
  }
  return { success: false, error: result.error }
}

interface SendImageInput {
  image: string
}

export async function executeFeishuSendImage(input: SendImageInput): Promise<ToolResult> {
  const chatId = getCurrentChatId()
  if (!chatId) {
    return { success: false, error: 'No active Feishu chat. User must send a message first.' }
  }

  const absolutePath = expandPath(input.image)
  if (!fileExists(absolutePath)) {
    return { success: false, error: `File not found: ${absolutePath}` }
  }

  const result = await feishuBotService.sendImage(chatId, absolutePath)

  if (result.success && result.messageId) {
    await storeSentMessage(result.messageId, chatId, undefined, [
      {
        id: result.messageId,
        name: path.basename(absolutePath),
        url: absolutePath,
        contentType: 'image/png',
        size: getFileSize(absolutePath)
      }
    ])
    return { success: true, data: { messageId: result.messageId } }
  }
  return { success: false, error: result.error }
}

interface SendFileInput {
  file: string
  filename?: string
}

export async function executeFeishuSendFile(input: SendFileInput): Promise<ToolResult> {
  const chatId = getCurrentChatId()
  if (!chatId) {
    return { success: false, error: 'No active Feishu chat. User must send a message first.' }
  }

  const absolutePath = expandPath(input.file)
  if (!fileExists(absolutePath)) {
    return { success: false, error: `File not found: ${absolutePath}` }
  }

  const result = await feishuBotService.sendFile(chatId, absolutePath, {
    filename: input.filename
  })

  if (result.success && result.messageId) {
    const fileName = input.filename || path.basename(absolutePath)
    await storeSentMessage(result.messageId, chatId, undefined, [
      {
        id: result.messageId,
        name: fileName,
        url: absolutePath,
        contentType: 'application/octet-stream',
        size: getFileSize(absolutePath)
      }
    ])
    return { success: true, data: { messageId: result.messageId } }
  }
  return { success: false, error: result.error }
}

interface SendCardInput {
  title: string
  content: string
  template?: string
}

export async function executeFeishuSendCard(input: SendCardInput): Promise<ToolResult> {
  const chatId = getCurrentChatId()
  if (!chatId) {
    return { success: false, error: 'No active Feishu chat. User must send a message first.' }
  }

  const card = {
    header: {
      title: {
        tag: 'plain_text',
        content: input.title
      },
      template: input.template || 'blue'
    },
    elements: [
      {
        tag: 'markdown',
        content: input.content
      }
    ]
  }

  const result = await feishuBotService.sendCard(chatId, card as any)

  if (result.success && result.messageId) {
    await storeSentMessage(result.messageId, chatId, `📋 ${input.title}\n\n${input.content}`)
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
export async function executeFeishuDeleteChatHistory(
  input: DeleteChatHistoryInput
): Promise<ToolResult> {
  try {
    let deletedCount = 0

    switch (input.mode) {
      case 'count': {
        if (!input.count || input.count <= 0) {
          return { success: false, error: 'count must be a positive number' }
        }
        deletedCount = await feishuStorage.deleteRecentMessages(input.count)
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
        
        console.log(`[Feishu] Deleting messages from ${startDate.toISOString()} to ${endDate.toISOString()}`)
        deletedCount = await feishuStorage.deleteMessagesByTimeRange(startDate, endDate)
        break
      }
      case 'all': {
        const totalCount = await feishuStorage.getTotalMessageCount()
        await feishuStorage.clearMessages()
        deletedCount = totalCount
        break
      }
      default:
        return { success: false, error: `Unknown mode: ${input.mode}. Use 'count', 'time_range', or 'all'` }
    }

    // Emit refresh event to update UI
    appEvents.emitMessagesRefresh('feishu')

    return {
      success: true,
      data: {
        deleted_count: deletedCount,
        message: `Successfully deleted ${deletedCount} message(s). Chat history refreshed.`
      }
    }
  } catch (error) {
    console.error('[Feishu] Delete chat history error:', error)
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

/**
 * Execute a Feishu tool by name
 */
export async function executeFeishuTool(name: string, input: unknown): Promise<ToolResult> {
  switch (name) {
    case 'feishu_send_text':
      return await executeFeishuSendText(input as SendTextInput)
    case 'feishu_send_image':
      return await executeFeishuSendImage(input as SendImageInput)
    case 'feishu_send_file':
      return await executeFeishuSendFile(input as SendFileInput)
    case 'feishu_send_card':
      return await executeFeishuSendCard(input as SendCardInput)
    case 'feishu_delete_chat_history':
      return await executeFeishuDeleteChatHistory(input as DeleteChatHistoryInput)
    default:
      return { success: false, error: `Unknown Feishu tool: ${name}` }
  }
}
