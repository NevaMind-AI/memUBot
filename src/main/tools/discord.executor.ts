import * as fs from 'fs'
import * as path from 'path'
import { discordBotService } from '../apps/discord/bot.service'

type ToolResult = { success: boolean; data?: unknown; error?: string }

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
}

export async function executeDiscordSendText(input: SendTextInput): Promise<ToolResult> {
  const channelId = getCurrentChannelId()
  if (!channelId) {
    return { success: false, error: 'No active Discord channel. User must send a message first.' }
  }

  const result = await discordBotService.sendText(channelId, input.text)

  if (result.success) {
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

  if (result.success) {
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

    if (result.success) {
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
    const result = await discordBotService.sendFile(channelId, imagePath, {
      filename: input.filename || path.basename(imagePath),
      description: input.description
    })

    if (result.success) {
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

  if (result.success) {
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
    default:
      return { success: false, error: `Unknown Discord tool: ${name}` }
  }
}
