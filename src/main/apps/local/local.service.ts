import { agentService } from '../../services/agent.service'
import { infraService } from '../../services/infra.service'
import { appEvents } from '../../events'
import type { AppMessage, BotStatus } from '../types'
import { localStorage } from './storage'
import type { StoredLocalMessage } from './types'

const DEFAULT_SESSION_ID = 'default'
const LOCAL_BOT_NAME = 'memU bot'
const LOCAL_USER_NAME = 'You'

function createMessageId(prefix: 'user' | 'assistant'): string {
  return `local-${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export class LocalChatService {
  readonly platform = 'local' as const
  private readonly status: BotStatus = {
    platform: 'local',
    isConnected: true,
    botName: LOCAL_BOT_NAME
  }
  private initialized = false

  async initialize(): Promise<void> {
    if (this.initialized) return
    await localStorage.initialize()
    appEvents.emitLocalStatusChanged(this.status)
    this.initialized = true
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize()
    }
  }

  getStatus(): BotStatus {
    return this.status
  }

  async getMessages(limit?: number, sessionId = DEFAULT_SESSION_ID): Promise<AppMessage[]> {
    await this.ensureInitialized()
    const messages = await localStorage.getMessages(limit, sessionId)
    return messages.map((message) => this.toAppMessage(message))
  }

  async clearMessages(sessionId = DEFAULT_SESSION_ID): Promise<void> {
    await this.ensureInitialized()
    await localStorage.clearMessages(sessionId)
    agentService.invalidateContextForPlatform('local')
    appEvents.emitMessagesRefresh('local')
  }

  async sendMessage(content: string, sessionId = DEFAULT_SESSION_ID): Promise<{ success: boolean; data?: AppMessage; error?: string }> {
    await this.ensureInitialized()

    const trimmed = content.trim()
    if (!trimmed) {
      return { success: false, error: 'Message cannot be empty' }
    }

    const userMessage = await this.storeAndEmitMessage({
      messageId: createMessageId('user'),
      sessionId,
      text: trimmed,
      date: Math.floor(Date.now() / 1000),
      isFromBot: false
    })

    infraService.publish('message:incoming', {
      platform: 'local',
      timestamp: Math.floor(Date.now() / 1000),
      message: { role: 'user', content: trimmed },
      metadata: {
        chatId: sessionId,
        messageId: userMessage.id,
        source: 'local-ui'
      }
    })

    const wasConsumed = await infraService.tryConsumeUserInput(trimmed, 'local')
    if (wasConsumed) {
      return { success: true, data: userMessage }
    }

    const response = await agentService.processMessage(trimmed, 'local', [], sessionId, undefined, {
      source: 'message',
      isAuthorizedUser: true,
      userId: 'local-user'
    })

    if (response.message) {
      await this.sendBotMessage(response.message, sessionId, userMessage.id)
    }

    if (!response.success && !response.message) {
      return { success: false, error: response.error || 'Failed to process local message' }
    }

    return { success: true, data: userMessage }
  }

  async sendBotMessage(
    content: string,
    sessionId = DEFAULT_SESSION_ID,
    replyToId?: string
  ): Promise<AppMessage> {
    await this.ensureInitialized()

    const storedMessage: StoredLocalMessage = {
      messageId: createMessageId('assistant'),
      sessionId,
      text: content,
      date: Math.floor(Date.now() / 1000),
      isFromBot: true,
      replyToMessageId: replyToId
    }

    const appMessage = await this.storeAndEmitMessage(storedMessage)
    infraService.publish('message:outgoing', {
      platform: 'local',
      timestamp: storedMessage.date,
      message: { role: 'assistant', content },
      metadata: {
        messageId: storedMessage.messageId,
        replyToId
      }
    })

    return appMessage
  }

  private async storeAndEmitMessage(message: StoredLocalMessage): Promise<AppMessage> {
    await localStorage.storeMessage(message)
    const appMessage = this.toAppMessage(message)
    appEvents.emitLocalNewMessage(appMessage)
    return appMessage
  }

  private toAppMessage(message: StoredLocalMessage): AppMessage {
    return {
      id: message.messageId,
      platform: 'local',
      chatId: message.sessionId,
      senderId: message.isFromBot ? 'local-bot' : 'local-user',
      senderName: message.isFromBot ? LOCAL_BOT_NAME : LOCAL_USER_NAME,
      content: message.text,
      timestamp: new Date(message.date * 1000),
      isFromBot: message.isFromBot,
      replyToId: message.replyToMessageId,
      metadata: message.metadata
    }
  }
}

export const localChatService = new LocalChatService()
