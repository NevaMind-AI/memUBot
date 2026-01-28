import { lineBotService } from '../apps/line/bot.service'

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
    default:
      return { success: false, error: `Unknown Line tool: ${name}` }
  }
}
