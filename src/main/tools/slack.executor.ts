import * as fs from 'fs'
import * as path from 'path'
import { slackBotService } from '../apps/slack/bot.service'
import { slackStorage } from '../apps/slack/storage'
import { appEvents } from '../events'
import type { StoredSlackMessage, StoredAttachment } from '../apps/slack/types'

type ToolResult = { success: boolean; data?: unknown; error?: string }

/**
 * Get the current channel ID
 */
function getCurrentChannelId(): string | null {
  return slackBotService.getCurrentChannelId()
}

/**
 * Store a sent message and emit event to update UI
 */
async function storeSentMessage(
  messageId: string,
  channelId: string,
  text?: string,
  threadTs?: string,
  attachments?: StoredAttachment[]
): Promise<void> {
  const botInfo = slackBotService.getStatus()
  const now = Math.floor(Date.now() / 1000)

  const storedMessage: StoredSlackMessage = {
    messageId,
    channelId,
    threadTs,
    fromId: 'bot',
    fromUsername: botInfo.username || 'Bot',
    fromDisplayName: botInfo.botName || 'Bot',
    text,
    attachments,
    date: now,
    isFromBot: true
  }

  await slackStorage.storeMessage(storedMessage)

  // Emit event to update UI (include attachments for immediate display)
  appEvents.emitSlackNewMessage({
    id: messageId,
    platform: 'slack',
    senderName: botInfo.botName || 'Bot',
    content: text || '',
    attachments: attachments?.map(att => ({
      id: att.id,
      name: att.name,
      url: att.url,
      contentType: att.mimetype,
      size: att.size || 0
    })),
    timestamp: new Date(now * 1000),
    isFromBot: true
  })
}

// ========== Tool Executors ==========

interface SendTextInput {
  text: string
  thread_ts?: string
}

export async function executeSlackSendText(input: SendTextInput): Promise<ToolResult> {
  const channelId = getCurrentChannelId()
  if (!channelId) {
    return { success: false, error: 'No active Slack channel. User must send a message first.' }
  }

  const result = await slackBotService.sendText(channelId, input.text, input.thread_ts)

  if (result.success && result.messageId) {
    await storeSentMessage(result.messageId, channelId, input.text, input.thread_ts)
    return { success: true, data: { messageId: result.messageId } }
  }
  return { success: false, error: result.error }
}

interface SendBlocksInput {
  blocks: unknown[]
  text?: string
  thread_ts?: string
}

export async function executeSlackSendBlocks(input: SendBlocksInput): Promise<ToolResult> {
  const channelId = getCurrentChannelId()
  if (!channelId) {
    return { success: false, error: 'No active Slack channel. User must send a message first.' }
  }

  const result = await slackBotService.sendBlocks(
    channelId,
    input.blocks,
    input.text,
    input.thread_ts
  )

  if (result.success && result.messageId) {
    await storeSentMessage(result.messageId, channelId, input.text || '[Blocks Message]', input.thread_ts)
    return { success: true, data: { messageId: result.messageId } }
  }
  return { success: false, error: result.error }
}

interface UploadFileInput {
  file_path: string
  filename?: string
  title?: string
  initial_comment?: string
}

export async function executeSlackUploadFile(input: UploadFileInput): Promise<ToolResult> {
  const channelId = getCurrentChannelId()
  if (!channelId) {
    return { success: false, error: 'No active Slack channel. User must send a message first.' }
  }

  const result = await slackBotService.uploadFile(
    channelId,
    input.file_path,
    input.filename,
    input.title,
    input.initial_comment
  )

  if (result.success && result.fileId) {
    const filename = input.filename || path.basename(input.file_path)
    let fileSize = 0
    try {
      fileSize = fs.statSync(input.file_path).size
    } catch {
      // Ignore file stat errors
    }
    const attachment: StoredAttachment = {
      id: result.fileId,
      name: filename,
      url: input.file_path,
      size: fileSize
    }
    // Use fileId as messageId for file uploads
    await storeSentMessage(result.fileId, channelId, input.initial_comment || `📎 ${filename}`, undefined, [attachment])
    return { success: true, data: { fileId: result.fileId } }
  }
  return { success: false, error: result.error }
}

interface AddReactionInput {
  message_ts: string
  emoji: string
}

export async function executeSlackAddReaction(input: AddReactionInput): Promise<ToolResult> {
  const channelId = getCurrentChannelId()
  if (!channelId) {
    return { success: false, error: 'No active Slack channel. User must send a message first.' }
  }

  const result = await slackBotService.addReaction(channelId, input.message_ts, input.emoji)

  if (result.success) {
    return { success: true, data: { emoji: input.emoji } }
  }
  return { success: false, error: result.error }
}

interface SendEphemeralInput {
  user_id: string
  text: string
}

export async function executeSlackSendEphemeral(input: SendEphemeralInput): Promise<ToolResult> {
  const channelId = getCurrentChannelId()
  if (!channelId) {
    return { success: false, error: 'No active Slack channel. User must send a message first.' }
  }

  const result = await slackBotService.sendEphemeral(channelId, input.user_id, input.text)

  if (result.success) {
    return { success: true, data: { sent: true } }
  }
  return { success: false, error: result.error }
}

/**
 * Execute a Slack tool by name
 */
export async function executeSlackTool(name: string, input: unknown): Promise<ToolResult> {
  switch (name) {
    case 'slack_send_text':
      return await executeSlackSendText(input as SendTextInput)
    case 'slack_send_blocks':
      return await executeSlackSendBlocks(input as SendBlocksInput)
    case 'slack_upload_file':
      return await executeSlackUploadFile(input as UploadFileInput)
    case 'slack_add_reaction':
      return await executeSlackAddReaction(input as AddReactionInput)
    case 'slack_send_ephemeral':
      return await executeSlackSendEphemeral(input as SendEphemeralInput)
    default:
      return { success: false, error: `Unknown Slack tool: ${name}` }
  }
}
