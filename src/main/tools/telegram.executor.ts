import * as fs from 'fs'
import * as path from 'path'
import TelegramBot from 'node-telegram-bot-api'
import { telegramBotService } from '../apps/telegram/bot.service'
import { telegramStorage } from '../apps/telegram/storage'
import { appEvents } from '../events'
import type { StoredTelegramMessage, StoredTelegramAttachment } from '../apps/telegram/types'

type ToolResult = { success: boolean; data?: unknown; error?: string }

/**
 * Store a sent message and emit event to update UI
 */
async function storeSentMessage(
  msg: TelegramBot.Message,
  text?: string,
  attachments?: StoredTelegramAttachment[]
): Promise<void> {
  const storedMessage: StoredTelegramMessage = {
    messageId: msg.message_id,
    chatId: msg.chat.id,
    fromId: msg.from?.id,
    fromUsername: msg.from?.username,
    fromFirstName: msg.from?.first_name || 'Bot',
    text: text || msg.text || msg.caption,
    attachments,
    date: msg.date,
    isFromBot: true
  }

  await telegramStorage.storeMessage(storedMessage)
  
  // Emit event to update UI (include attachments for immediate display)
  appEvents.emitNewMessage({
    id: `${msg.chat.id}-${msg.message_id}`,
    platform: 'telegram',
    senderName: msg.from?.first_name || 'Bot',
    content: text || msg.text || msg.caption || '',
    attachments: attachments?.map(att => ({
      id: att.id,
      name: att.name,
      url: att.url,
      contentType: att.contentType,
      size: att.size || 0,
      width: att.width,
      height: att.height
    })),
    timestamp: new Date(msg.date * 1000),
    isFromBot: true
  })
}

/**
 * Extract photo attachment info from Telegram message
 */
function extractPhotoAttachment(msg: TelegramBot.Message, inputPath: string): StoredTelegramAttachment | undefined {
  if (!msg.photo || msg.photo.length === 0) return undefined
  const photo = msg.photo[msg.photo.length - 1] // Get largest photo
  return {
    id: photo.file_id,
    name: path.basename(inputPath),
    url: inputPath, // Store original path/URL for reference
    contentType: 'image/jpeg',
    size: photo.file_size,
    width: photo.width,
    height: photo.height
  }
}

/**
 * Extract document attachment info from Telegram message
 */
function extractDocumentAttachment(msg: TelegramBot.Message, inputPath: string): StoredTelegramAttachment | undefined {
  if (!msg.document) return undefined
  return {
    id: msg.document.file_id,
    name: msg.document.file_name || path.basename(inputPath),
    url: inputPath,
    contentType: msg.document.mime_type,
    size: msg.document.file_size
  }
}

/**
 * Extract video attachment info from Telegram message
 */
function extractVideoAttachment(msg: TelegramBot.Message, inputPath: string): StoredTelegramAttachment | undefined {
  if (!msg.video) return undefined
  return {
    id: msg.video.file_id,
    name: path.basename(inputPath),
    url: inputPath,
    contentType: msg.video.mime_type || 'video/mp4',
    size: msg.video.file_size,
    width: msg.video.width,
    height: msg.video.height
  }
}

/**
 * Extract audio attachment info from Telegram message
 */
function extractAudioAttachment(msg: TelegramBot.Message, inputPath: string): StoredTelegramAttachment | undefined {
  if (!msg.audio) return undefined
  return {
    id: msg.audio.file_id,
    name: msg.audio.file_name || path.basename(inputPath),
    url: inputPath,
    contentType: msg.audio.mime_type || 'audio/mpeg',
    size: msg.audio.file_size
  }
}

/**
 * Extract voice attachment info from Telegram message
 */
function extractVoiceAttachment(msg: TelegramBot.Message, inputPath: string): StoredTelegramAttachment | undefined {
  if (!msg.voice) return undefined
  return {
    id: msg.voice.file_id,
    name: path.basename(inputPath),
    url: inputPath,
    contentType: msg.voice.mime_type || 'audio/ogg',
    size: msg.voice.file_size
  }
}

/**
 * Get the current chat ID, or return an error if not available
 */
function getCurrentChatId(): number | null {
  return telegramBotService.getCurrentChatId()
}

/**
 * Check if a path is a URL
 */
function isUrl(str: string): boolean {
  return str.startsWith('http://') || str.startsWith('https://')
}

/**
 * Resolved file with buffer and filename
 */
interface ResolvedFile {
  content: string | Buffer
  filename?: string
}

/**
 * Resolve file path and return buffer with filename, or URL string
 */
function resolveFile(filePath: string): ResolvedFile {
  if (isUrl(filePath)) {
    return { content: filePath }
  }
  // Resolve absolute path
  const absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(filePath)
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`File not found: ${absolutePath}`)
  }
  return {
    content: fs.readFileSync(absolutePath),
    filename: path.basename(absolutePath)
  }
}

// ========== Tool Executors ==========

interface SendTextInput {
  text: string
  parse_mode?: 'Markdown' | 'HTML'
}

export async function executeTelegramSendText(input: SendTextInput): Promise<ToolResult> {
  const chatId = getCurrentChatId()
  if (!chatId) {
    return { success: false, error: 'No active Telegram chat. User must send a message first.' }
  }

  const result = await telegramBotService.sendText(chatId, input.text, {
    parse_mode: input.parse_mode
  })

  if (result.success && result.message) {
    await storeSentMessage(result.message, input.text)
    return { success: true, data: { messageId: result.messageId } }
  }
  return { success: false, error: result.error }
}

interface SendPhotoInput {
  photo: string
  caption?: string
  parse_mode?: 'Markdown' | 'HTML'
}

export async function executeTelegramSendPhoto(input: SendPhotoInput): Promise<ToolResult> {
  const chatId = getCurrentChatId()
  if (!chatId) {
    return { success: false, error: 'No active Telegram chat. User must send a message first.' }
  }

  try {
    const resolved = resolveFile(input.photo)
    const result = await telegramBotService.sendPhoto(chatId, resolved.content, {
      caption: input.caption,
      parse_mode: input.parse_mode,
      filename: resolved.filename
    })

    if (result.success && result.message) {
      const attachment = extractPhotoAttachment(result.message, input.photo)
      await storeSentMessage(result.message, input.caption, attachment ? [attachment] : undefined)
      return { success: true, data: { messageId: result.messageId } }
    }
    return { success: false, error: result.error }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

interface SendDocumentInput {
  document: string
  caption?: string
  filename?: string
}

export async function executeTelegramSendDocument(input: SendDocumentInput): Promise<ToolResult> {
  const chatId = getCurrentChatId()
  if (!chatId) {
    return { success: false, error: 'No active Telegram chat. User must send a message first.' }
  }

  try {
    const resolved = resolveFile(input.document)
    const result = await telegramBotService.sendDocument(chatId, resolved.content, {
      caption: input.caption,
      filename: input.filename || resolved.filename
    })

    if (result.success && result.message) {
      const attachment = extractDocumentAttachment(result.message, input.document)
      await storeSentMessage(result.message, input.caption, attachment ? [attachment] : undefined)
      return { success: true, data: { messageId: result.messageId } }
    }
    return { success: false, error: result.error }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

interface SendVideoInput {
  video: string
  caption?: string
  duration?: number
  width?: number
  height?: number
}

export async function executeTelegramSendVideo(input: SendVideoInput): Promise<ToolResult> {
  const chatId = getCurrentChatId()
  if (!chatId) {
    return { success: false, error: 'No active Telegram chat. User must send a message first.' }
  }

  try {
    const resolved = resolveFile(input.video)
    const result = await telegramBotService.sendVideo(chatId, resolved.content, {
      caption: input.caption,
      duration: input.duration,
      width: input.width,
      height: input.height,
      filename: resolved.filename
    })

    if (result.success && result.message) {
      const attachment = extractVideoAttachment(result.message, input.video)
      await storeSentMessage(result.message, input.caption, attachment ? [attachment] : undefined)
      return { success: true, data: { messageId: result.messageId } }
    }
    return { success: false, error: result.error }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

interface SendAudioInput {
  audio: string
  caption?: string
  duration?: number
  performer?: string
  title?: string
}

export async function executeTelegramSendAudio(input: SendAudioInput): Promise<ToolResult> {
  const chatId = getCurrentChatId()
  if (!chatId) {
    return { success: false, error: 'No active Telegram chat. User must send a message first.' }
  }

  try {
    const resolved = resolveFile(input.audio)
    const result = await telegramBotService.sendAudio(chatId, resolved.content, {
      caption: input.caption,
      duration: input.duration,
      performer: input.performer,
      title: input.title,
      filename: resolved.filename
    })

    if (result.success && result.message) {
      const attachment = extractAudioAttachment(result.message, input.audio)
      await storeSentMessage(result.message, input.caption, attachment ? [attachment] : undefined)
      return { success: true, data: { messageId: result.messageId } }
    }
    return { success: false, error: result.error }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

interface SendVoiceInput {
  voice: string
  caption?: string
  duration?: number
}

export async function executeTelegramSendVoice(input: SendVoiceInput): Promise<ToolResult> {
  const chatId = getCurrentChatId()
  if (!chatId) {
    return { success: false, error: 'No active Telegram chat. User must send a message first.' }
  }

  try {
    const resolved = resolveFile(input.voice)
    const result = await telegramBotService.sendVoice(chatId, resolved.content, {
      caption: input.caption,
      duration: input.duration,
      filename: resolved.filename
    })

    if (result.success && result.message) {
      const attachment = extractVoiceAttachment(result.message, input.voice)
      await storeSentMessage(result.message, input.caption, attachment ? [attachment] : undefined)
      return { success: true, data: { messageId: result.messageId } }
    }
    return { success: false, error: result.error }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

interface SendLocationInput {
  latitude: number
  longitude: number
}

export async function executeTelegramSendLocation(input: SendLocationInput): Promise<ToolResult> {
  const chatId = getCurrentChatId()
  if (!chatId) {
    return { success: false, error: 'No active Telegram chat. User must send a message first.' }
  }

  const result = await telegramBotService.sendLocation(chatId, input.latitude, input.longitude)

  if (result.success && result.message) {
    await storeSentMessage(result.message, `📍 Location: ${input.latitude}, ${input.longitude}`)
    return { success: true, data: { messageId: result.messageId } }
  }
  return { success: false, error: result.error }
}

interface SendContactInput {
  phone_number: string
  first_name: string
  last_name?: string
}

export async function executeTelegramSendContact(input: SendContactInput): Promise<ToolResult> {
  const chatId = getCurrentChatId()
  if (!chatId) {
    return { success: false, error: 'No active Telegram chat. User must send a message first.' }
  }

  const result = await telegramBotService.sendContact(
    chatId,
    input.phone_number,
    input.first_name,
    { last_name: input.last_name }
  )

  if (result.success && result.message) {
    const contactName = input.last_name ? `${input.first_name} ${input.last_name}` : input.first_name
    await storeSentMessage(result.message, `👤 Contact: ${contactName} (${input.phone_number})`)
    return { success: true, data: { messageId: result.messageId } }
  }
  return { success: false, error: result.error }
}

interface SendPollInput {
  question: string
  options: string[]
  is_anonymous?: boolean
  allows_multiple_answers?: boolean
}

export async function executeTelegramSendPoll(input: SendPollInput): Promise<ToolResult> {
  const chatId = getCurrentChatId()
  if (!chatId) {
    return { success: false, error: 'No active Telegram chat. User must send a message first.' }
  }

  const result = await telegramBotService.sendPoll(chatId, input.question, input.options, {
    is_anonymous: input.is_anonymous,
    allows_multiple_answers: input.allows_multiple_answers
  })

  if (result.success && result.message) {
    const optionsText = input.options.map((opt, i) => `${i + 1}. ${opt}`).join('\n')
    await storeSentMessage(result.message, `📊 Poll: ${input.question}\n\n${optionsText}`)
    return { success: true, data: { messageId: result.messageId } }
  }
  return { success: false, error: result.error }
}

interface SendStickerInput {
  sticker: string
}

export async function executeTelegramSendSticker(input: SendStickerInput): Promise<ToolResult> {
  const chatId = getCurrentChatId()
  if (!chatId) {
    return { success: false, error: 'No active Telegram chat. User must send a message first.' }
  }

  try {
    // Stickers can be file_id, URL, or file path
    let stickerContent: string | Buffer = input.sticker
    let filename: string | undefined
    if (!isUrl(input.sticker) && !input.sticker.startsWith('CAA')) {
      // Likely a file path, not a file_id
      const resolved = resolveFile(input.sticker)
      stickerContent = resolved.content
      filename = resolved.filename
    }

    const result = await telegramBotService.sendSticker(chatId, stickerContent, { filename })

    if (result.success && result.message) {
      await storeSentMessage(result.message, '🎨 Sticker')
      return { success: true, data: { messageId: result.messageId } }
    }
    return { success: false, error: result.error }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

interface SendChatActionInput {
  action:
    | 'typing'
    | 'upload_photo'
    | 'upload_video'
    | 'upload_voice'
    | 'upload_document'
    | 'find_location'
    | 'record_video'
    | 'record_voice'
    | 'record_video_note'
    | 'upload_video_note'
}

export async function executeTelegramSendChatAction(
  input: SendChatActionInput
): Promise<ToolResult> {
  const chatId = getCurrentChatId()
  if (!chatId) {
    return { success: false, error: 'No active Telegram chat. User must send a message first.' }
  }

  const result = await telegramBotService.sendChatAction(chatId, input.action)

  if (result.success) {
    return { success: true, data: { action: input.action } }
  }
  return { success: false, error: result.error }
}

/**
 * Execute a Telegram tool by name
 */
export async function executeTelegramTool(
  name: string,
  input: unknown
): Promise<ToolResult> {
  switch (name) {
    case 'telegram_send_text':
      return await executeTelegramSendText(input as SendTextInput)
    case 'telegram_send_photo':
      return await executeTelegramSendPhoto(input as SendPhotoInput)
    case 'telegram_send_document':
      return await executeTelegramSendDocument(input as SendDocumentInput)
    case 'telegram_send_video':
      return await executeTelegramSendVideo(input as SendVideoInput)
    case 'telegram_send_audio':
      return await executeTelegramSendAudio(input as SendAudioInput)
    case 'telegram_send_voice':
      return await executeTelegramSendVoice(input as SendVoiceInput)
    case 'telegram_send_location':
      return await executeTelegramSendLocation(input as SendLocationInput)
    case 'telegram_send_contact':
      return await executeTelegramSendContact(input as SendContactInput)
    case 'telegram_send_poll':
      return await executeTelegramSendPoll(input as SendPollInput)
    case 'telegram_send_sticker':
      return await executeTelegramSendSticker(input as SendStickerInput)
    case 'telegram_send_chat_action':
      return await executeTelegramSendChatAction(input as SendChatActionInput)
    default:
      return { success: false, error: `Unknown Telegram tool: ${name}` }
  }
}
