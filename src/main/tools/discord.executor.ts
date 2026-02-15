import * as fs from 'fs'
import * as path from 'path'
import { discordBotService } from '../apps/discord/bot.service'
import { discordStorage } from '../apps/discord/storage'
import { appEvents } from '../events'
import type { StoredDiscordMessage, StoredAttachment } from '../apps/discord/types'

type ToolResult = { success: boolean; data?: unknown; error?: string }

/**
 * Store a sent message and emit event to update UI
 */
async function storeSentMessage(
  messageId: string,
  channelId: string,
  text?: string,
  attachments?: StoredAttachment[]
): Promise<void> {
  const botInfo = discordBotService.getStatus()
  const now = Math.floor(Date.now() / 1000)

  const storedMessage: StoredDiscordMessage = {
    messageId,
    channelId,
    fromId: 'bot',
    fromUsername: botInfo.username || 'Bot',
    fromDisplayName: botInfo.botName || 'Bot',
    text,
    attachments,
    date: now,
    isFromBot: true
  }

  await discordStorage.storeMessage(storedMessage)

  // Emit event to update UI (include attachments for immediate display)
  appEvents.emitDiscordNewMessage({
    id: messageId,
    platform: 'discord',
    chatId: channelId,
    senderId: 'bot',
    senderName: botInfo.botName || 'Bot',
    content: text || '',
    attachments: attachments?.map(att => ({
      id: att.id,
      name: att.name,
      url: att.url,
      contentType: att.contentType,
      size: att.size,
      width: att.width,
      height: att.height
    })),
    timestamp: new Date(now * 1000),
    isFromBot: true
  })
}

/**
 * Get the current channel ID, or return null if not available
 */
function getCurrentChannelId(): string | null {
  return discordBotService.getCurrentChannelId()
}

/**
 * Check if a path is a URL
 */
function isUrl(str: string): boolean {
  return str.startsWith('http://') || str.startsWith('https://')
}

/**
 * Resolve file path to absolute path
 */
function resolveFilePath(filePath: string): string {
  if (isUrl(filePath)) {
    return filePath
  }
  const absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(filePath)
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`File not found: ${absolutePath}`)
  }
  return absolutePath
}

// ========== Tool Executors ==========

interface SendTextInput {
  text: string
  /** @internal Used by sendIntentSummaryToUser to skip storage */
  _storeInHistory?: boolean
}

export async function executeDiscordSendText(input: SendTextInput): Promise<ToolResult> {
  const channelId = getCurrentChannelId()
  if (!channelId) {
    return { success: false, error: 'No active Discord channel. User must send a message first.' }
  }

  const shouldStore = input._storeInHistory !== false
  const result = await discordBotService.sendText(channelId, input.text, { storeInHistory: shouldStore })

  if (result.success && result.messageId) {
    if (shouldStore) {
      await storeSentMessage(result.messageId, channelId, input.text)
    }
    return { success: true, data: { messageId: result.messageId } }
  }
  return { success: false, error: result.error }
}

interface SendEmbedInput {
  title?: string
  description?: string
  color?: number
  url?: string
  footer?: string
  thumbnail_url?: string
  image_url?: string
  fields?: Array<{ name: string; value: string; inline?: boolean }>
}

export async function executeDiscordSendEmbed(input: SendEmbedInput): Promise<ToolResult> {
  const channelId = getCurrentChannelId()
  if (!channelId) {
    return { success: false, error: 'No active Discord channel. User must send a message first.' }
  }

  const result = await discordBotService.sendEmbed(channelId, input)

  if (result.success && result.messageId) {
    // Build text representation of embed
    const parts: string[] = []
    if (input.title) parts.push(`**${input.title}**`)
    if (input.description) parts.push(input.description)
    if (input.fields) {
      input.fields.forEach(f => parts.push(`**${f.name}:** ${f.value}`))
    }
    await storeSentMessage(result.messageId, channelId, parts.join('\n') || '[Embed]')
    return { success: true, data: { messageId: result.messageId } }
  }
  return { success: false, error: result.error }
}

interface SendFileInput {
  file_path: string
  filename?: string
  description?: string
}

export async function executeDiscordSendFile(input: SendFileInput): Promise<ToolResult> {
  const channelId = getCurrentChannelId()
  if (!channelId) {
    return { success: false, error: 'No active Discord channel. User must send a message first.' }
  }

  try {
    const absolutePath = resolveFilePath(input.file_path)
    const result = await discordBotService.sendFile(channelId, absolutePath, {
      filename: input.filename,
      description: input.description
    })

    if (result.success && result.messageId) {
      const filename = input.filename || path.basename(absolutePath)
      const attachment: StoredAttachment = {
        id: result.messageId,
        name: filename,
        url: absolutePath,
        size: fs.statSync(absolutePath).size
      }
      await storeSentMessage(result.messageId, channelId, input.description, [attachment])
      return { success: true, data: { messageId: result.messageId } }
    }
    return { success: false, error: result.error }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

interface SendImageInput {
  image: string
  filename?: string
  description?: string
}

export async function executeDiscordSendImage(input: SendImageInput): Promise<ToolResult> {
  const channelId = getCurrentChannelId()
  if (!channelId) {
    return { success: false, error: 'No active Discord channel. User must send a message first.' }
  }

  try {
    const imagePath = resolveFilePath(input.image)
    const filename = input.filename || path.basename(imagePath)
    const result = await discordBotService.sendFile(channelId, imagePath, {
      filename,
      description: input.description
    })

    if (result.success && result.messageId) {
      const ext = path.extname(filename).toLowerCase()
      const contentType = ext === '.png' ? 'image/png' : ext === '.gif' ? 'image/gif' : 'image/jpeg'
      const attachment: StoredAttachment = {
        id: result.messageId,
        name: filename,
        url: imagePath,
        contentType,
        size: fs.statSync(imagePath).size
      }
      await storeSentMessage(result.messageId, channelId, input.description, [attachment])
      return { success: true, data: { messageId: result.messageId } }
    }
    return { success: false, error: result.error }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

interface ReplyInput {
  message_id: string
  text: string
}

export async function executeDiscordReply(input: ReplyInput): Promise<ToolResult> {
  const channelId = getCurrentChannelId()
  if (!channelId) {
    return { success: false, error: 'No active Discord channel. User must send a message first.' }
  }

  const result = await discordBotService.reply(channelId, input.message_id, input.text)

  if (result.success && result.messageId) {
    await storeSentMessage(result.messageId, channelId, input.text)
    return { success: true, data: { messageId: result.messageId } }
  }
  return { success: false, error: result.error }
}

interface AddReactionInput {
  message_id: string
  emoji: string
}

export async function executeDiscordAddReaction(input: AddReactionInput): Promise<ToolResult> {
  const channelId = getCurrentChannelId()
  if (!channelId) {
    return { success: false, error: 'No active Discord channel. User must send a message first.' }
  }

  const result = await discordBotService.addReaction(channelId, input.message_id, input.emoji)

  if (result.success) {
    return { success: true, data: { emoji: input.emoji } }
  }
  return { success: false, error: result.error }
}

export async function executeDiscordTyping(): Promise<ToolResult> {
  const channelId = getCurrentChannelId()
  if (!channelId) {
    return { success: false, error: 'No active Discord channel. User must send a message first.' }
  }

  const result = await discordBotService.sendTyping(channelId)

  if (result.success) {
    return { success: true, data: { typing: true } }
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
export async function executeDiscordDeleteChatHistory(
  input: DeleteChatHistoryInput
): Promise<ToolResult> {
  try {
    let deletedCount = 0

    switch (input.mode) {
      case 'count': {
        if (!input.count || input.count <= 0) {
          return { success: false, error: 'count must be a positive number' }
        }
        deletedCount = await discordStorage.deleteRecentMessages(input.count)
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
        
        console.log(`[Discord] Deleting messages from ${startDate.toISOString()} to ${endDate.toISOString()}`)
        deletedCount = await discordStorage.deleteMessagesByTimeRange(startDate, endDate)
        break
      }
      case 'all': {
        const totalCount = await discordStorage.getMessageCount()
        await discordStorage.clearMessages()
        deletedCount = totalCount
        break
      }
      default:
        return { success: false, error: `Unknown mode: ${input.mode}. Use 'count', 'time_range', or 'all'` }
    }

    // Emit refresh event to update UI
    // Note: Don't clear agentService.conversationHistory here, as the current 
    // conversation is still in progress.
    appEvents.emitMessagesRefresh('discord')

    return {
      success: true,
      data: {
        deleted_count: deletedCount,
        message: `Successfully deleted ${deletedCount} message(s). Chat history refreshed.`
      }
    }
  } catch (error) {
    console.error('[Discord] Delete chat history error:', error)
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

/**
 * Execute a Discord tool by name
 */
export async function executeDiscordTool(
  name: string,
  input: unknown
): Promise<ToolResult> {
  switch (name) {
    case 'discord_send_text':
      return await executeDiscordSendText(input as SendTextInput)
    case 'discord_send_embed':
      return await executeDiscordSendEmbed(input as SendEmbedInput)
    case 'discord_send_file':
      return await executeDiscordSendFile(input as SendFileInput)
    case 'discord_send_image':
      return await executeDiscordSendImage(input as SendImageInput)
    case 'discord_reply':
      return await executeDiscordReply(input as ReplyInput)
    case 'discord_add_reaction':
      return await executeDiscordAddReaction(input as AddReactionInput)
    case 'discord_typing':
      return await executeDiscordTyping()
    case 'discord_delete_chat_history':
      return await executeDiscordDeleteChatHistory(input as DeleteChatHistoryInput)
    default:
      return { success: false, error: `Unknown Discord tool: ${name}` }
  }
}
