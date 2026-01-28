import { whatsappBotService } from '../apps/whatsapp/bot.service'

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
    default:
      return { success: false, error: `Unknown WhatsApp tool: ${name}` }
  }
}
