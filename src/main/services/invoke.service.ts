import { agentService, type MessagePlatform, type EvaluationContext, type EvaluationData } from './agent.service'
import { telegramBotService } from '../apps/telegram'
import { discordBotService } from '../apps/discord/bot.service'
import { slackBotService } from '../apps/slack/bot.service'
import { whatsappBotService } from '../apps/whatsapp/bot.service'
import { lineBotService } from '../apps/line/bot.service'
import { securityService } from './security.service'

/**
 * Invoke Service
 * Handles evaluation and notification logic for automated monitoring services
 */

/**
 * Invoke request context - user's original request/expectation
 */
export interface InvokeContext {
  userRequest: string       // Original user request, e.g., "Monitor XX stock for me"
  expectation: string       // What user expects, e.g., "Notify when price changes > 3%"
  notifyPlatform?: string   // Platform to notify user (telegram, discord, etc.)
}

/**
 * Invoke request data - information gathered by the monitoring service
 */
export interface InvokeData {
  summary: string           // Brief summary of the event
  details?: string          // Detailed information (optional)
  timestamp: string         // ISO timestamp
  metadata?: Record<string, unknown>  // Additional metadata
}

/**
 * Invoke request payload
 */
export interface InvokeRequest {
  context: InvokeContext
  data: InvokeData
  serviceId?: string        // Optional service identifier for tracking
}

/**
 * Invoke response action
 */
export type InvokeAction = 'notified' | 'ignored' | 'error'

/**
 * Invoke result
 */
export interface InvokeResult {
  success: boolean
  action: InvokeAction
  reason: string
  notificationSent: boolean
  platform?: MessagePlatform
  message?: string
  error?: string
}

/**
 * Invoke Service class
 */
class InvokeService {
  /**
   * Process an invoke request:
   * 1. Determine notification platform
   * 2. Call LLM to evaluate whether to notify
   * 3. If shouldNotify, send message via the appropriate platform
   */
  async process(request: InvokeRequest): Promise<InvokeResult> {
    const { context, data, serviceId } = request

    console.log(`[Invoke] Processing request from service: ${serviceId || 'unknown'}`)

    // Determine which platform to use for notification
    const platform = this.determinePlatform(context.notifyPlatform)

    // If no platform available, we can't notify the user
    if (platform === 'none') {
      console.log('[Invoke] No notification platform available')
      return {
        success: true,
        action: 'ignored',
        reason: 'No notification platform configured or recently used',
        notificationSent: false
      }
    }

    // Step 1: Call LLM to evaluate
    const evaluationContext: EvaluationContext = {
      userRequest: context.userRequest,
      expectation: context.expectation
    }
    const evaluationData: EvaluationData = {
      summary: data.summary,
      details: data.details,
      timestamp: data.timestamp,
      metadata: data.metadata
    }

    const evalResult = await agentService.evaluate(evaluationContext, evaluationData)

    if (!evalResult.success || !evalResult.decision) {
      return {
        success: false,
        action: 'error',
        reason: evalResult.error || 'Evaluation failed',
        notificationSent: false,
        error: evalResult.error
      }
    }

    const decision = evalResult.decision

    // Step 2: If shouldNotify is false, return ignored
    if (!decision.shouldNotify) {
      console.log(`[Invoke] Decision: IGNORE - ${decision.reason}`)
      return {
        success: true,
        action: 'ignored',
        reason: decision.reason,
        notificationSent: false,
        platform
      }
    }

    // Step 3: Send notification via the platform
    console.log(`[Invoke] Decision: NOTIFY via ${platform} - ${decision.reason}`)
    const sendResult = await this.sendNotification(platform, decision.message!)

    if (!sendResult.success) {
      return {
        success: false,
        action: 'error',
        reason: `Failed to send notification: ${sendResult.error}`,
        notificationSent: false,
        platform,
        error: sendResult.error
      }
    }

    return {
      success: true,
      action: 'notified',
      reason: decision.reason,
      notificationSent: true,
      platform,
      message: decision.message
    }
  }

  /**
   * Determine which platform to use for notification
   * Priority: specified platform > recent reply platform > none
   */
  private determinePlatform(specifiedPlatform?: string): MessagePlatform {
    if (specifiedPlatform) {
      const validPlatforms: MessagePlatform[] = ['telegram', 'discord', 'whatsapp', 'slack', 'line']
      if (validPlatforms.includes(specifiedPlatform as MessagePlatform)) {
        return specifiedPlatform as MessagePlatform
      }
    }
    return agentService.getRecentReplyPlatform()
  }

  /**
   * Send notification via the specified platform
   * Priority: current active chat > bound users
   */
  private async sendNotification(
    platform: MessagePlatform,
    message: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      switch (platform) {
        case 'telegram': {
          // Try current chat first, then fall back to bound users
          let chatId = telegramBotService.getCurrentChatId()
          if (!chatId) {
            const boundUsers = await securityService.getBoundUsers('telegram')
            if (boundUsers.length > 0) {
              chatId = boundUsers[0].userId
              console.log(`[Invoke] Using bound user for Telegram: ${chatId}`)
            }
          }
          if (!chatId) {
            return { success: false, error: 'No Telegram chat available (no active chat and no bound users)' }
          }
          return await telegramBotService.sendText(chatId, message)
        }

        case 'discord': {
          // Try current channel first, then fall back to DM to bound users
          const channelId = discordBotService.getCurrentChannelId()
          if (channelId) {
            return await discordBotService.sendText(channelId, message)
          }
          // No active channel, try to DM bound users
          const discordBoundUsers = await securityService.getBoundUsers('discord')
          if (discordBoundUsers.length > 0) {
            // uniqueId is user ID, send DM
            const userId = discordBoundUsers[0].uniqueId
            console.log(`[Invoke] Sending DM to Discord user: ${userId}`)
            return await discordBotService.sendDMToUser(userId, message)
          }
          return { success: false, error: 'No Discord channel available (no active channel and no bound users)' }
        }

        case 'slack': {
          // Try current channel first, then fall back to DM to bound users
          const slackChannelId = slackBotService.getCurrentChannelId()
          if (slackChannelId) {
            return await slackBotService.sendText(slackChannelId, message)
          }
          // No active channel, try to DM bound users
          const slackBoundUsers = await securityService.getBoundUsers('slack')
          if (slackBoundUsers.length > 0) {
            // uniqueId is user ID, send DM
            const userId = slackBoundUsers[0].uniqueId
            console.log(`[Invoke] Sending DM to Slack user: ${userId}`)
            return await slackBotService.sendDMToUser(userId, message)
          }
          return { success: false, error: 'No Slack channel available (no active channel and no bound users)' }
        }

        case 'whatsapp': {
          const chatId = whatsappBotService.getCurrentChatId()
          if (!chatId) {
            return { success: false, error: 'No active WhatsApp chat' }
          }
          return await whatsappBotService.sendText(chatId, message)
        }

        case 'line': {
          const source = lineBotService.getCurrentSource()
          if (!source.id) {
            return { success: false, error: 'No active Line chat' }
          }
          return await lineBotService.sendText(source.id, message)
        }

        default:
          return { success: false, error: `Unsupported platform: ${platform}` }
      }
    } catch (error) {
      console.error(`[Invoke] Failed to send notification via ${platform}:`, error)
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  /**
   * Validate invoke request payload
   */
  validateRequest(payload: unknown): { valid: boolean; error?: string } {
    const request = payload as InvokeRequest

    if (!request.context) {
      return { valid: false, error: 'Missing "context" field' }
    }
    if (!request.context.userRequest || typeof request.context.userRequest !== 'string') {
      return { valid: false, error: 'Missing or invalid "context.userRequest" field' }
    }
    if (!request.context.expectation || typeof request.context.expectation !== 'string') {
      return { valid: false, error: 'Missing or invalid "context.expectation" field' }
    }
    if (!request.data) {
      return { valid: false, error: 'Missing "data" field' }
    }
    if (!request.data.summary || typeof request.data.summary !== 'string') {
      return { valid: false, error: 'Missing or invalid "data.summary" field' }
    }
    if (!request.data.timestamp || typeof request.data.timestamp !== 'string') {
      return { valid: false, error: 'Missing or invalid "data.timestamp" field' }
    }
    return { valid: true }
  }
}

// Export singleton instance
export const invokeService = new InvokeService()
