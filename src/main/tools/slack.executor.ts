import { slackBotService } from '../apps/slack/bot.service'

type ToolResult = { success: boolean; data?: unknown; error?: string }

/**
 * Get the current channel ID
 */
function getCurrentChannelId(): string | null {
  return slackBotService.getCurrentChannelId()
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

  if (result.success) {
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

  if (result.success) {
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

  if (result.success) {
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
