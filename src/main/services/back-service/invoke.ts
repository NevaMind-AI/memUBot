/**
 * Invoke Service
 *
 * Handles evaluation and notification logic for automated monitoring services.
 * Includes rate limiting (#5), retry on failure (#6), and fixed platform list (#2).
 */

import {
  agentService,
  type MessagePlatform,
  type EvaluationContext,
  type EvaluationData
} from '../agent.service'
import { telegramBotService } from '../../apps/telegram'
import { discordBotService } from '../../apps/discord/bot.service'
import { slackBotService } from '../../apps/slack/bot.service'
import { whatsappBotService } from '../../apps/whatsapp/bot.service'
import { lineBotService } from '../../apps/line/bot.service'
import { feishuBotService } from '../../apps/feishu/bot.service'
import { securityService } from '../security.service'
import * as rateLimiter from './rate-limiter'
import { INVOKE_MAX_RETRIES, INVOKE_RETRY_DELAY_MS } from './constants'
import type { InvokeRequest, InvokeResult } from './types'

// ============================================
// Valid notification platforms (fix #2: includes feishu)
// ============================================

const VALID_PLATFORMS: MessagePlatform[] = [
  'telegram', 'discord', 'whatsapp', 'slack', 'line', 'feishu'
]

// ============================================
// Invoke Service
// ============================================

class InvokeService {
  /**
   * Process an invoke request:
   * 1. Rate-limit check
   * 2. Determine notification platform
   * 3. Call LLM to evaluate (with retry)
   * 4. If shouldNotify, send message via the appropriate platform
   */
  async process(request: InvokeRequest): Promise<InvokeResult> {
    const { context, data, serviceId } = request
    const svcId = serviceId || 'unknown'

    console.log(`[Invoke] Processing request from service: ${svcId}`)

    // Rate limit check (#5)
    if (serviceId && !rateLimiter.isAllowed(serviceId)) {
      const remaining = rateLimiter.getRemainingCalls(serviceId)
      console.warn(`[Invoke] Rate limited: ${svcId} (${remaining} remaining)`)
      return {
        success: true,
        action: 'rate_limited',
        reason: `Rate limited. Max calls per minute exceeded. Remaining: ${remaining}`,
        notificationSent: false
      }
    }

    // Record the call for rate limiting
    if (serviceId) {
      rateLimiter.recordCall(serviceId)
    }

    // Determine platform
    const platform = this.determinePlatform(context.notifyPlatform)
    if (platform === 'none') {
      console.log('[Invoke] No notification platform available')
      return {
        success: true,
        action: 'ignored',
        reason: 'No notification platform configured or recently used',
        notificationSent: false
      }
    }

    // LLM evaluation with retry (#6)
    const evalResult = await this.evaluateWithRetry(context, data)

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

    // Send notification
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

  /** Validate invoke request payload */
  validateRequest(payload: unknown): { valid: boolean; error?: string } {
    const request = payload as InvokeRequest
    if (!request.context) return { valid: false, error: 'Missing "context" field' }
    if (!request.context.userRequest || typeof request.context.userRequest !== 'string') {
      return { valid: false, error: 'Missing or invalid "context.userRequest"' }
    }
    if (!request.context.expectation || typeof request.context.expectation !== 'string') {
      return { valid: false, error: 'Missing or invalid "context.expectation"' }
    }
    if (!request.data) return { valid: false, error: 'Missing "data" field' }
    if (!request.data.summary || typeof request.data.summary !== 'string') {
      return { valid: false, error: 'Missing or invalid "data.summary"' }
    }
    if (!request.data.timestamp || typeof request.data.timestamp !== 'string') {
      return { valid: false, error: 'Missing or invalid "data.timestamp"' }
    }
    return { valid: true }
  }

  // ============================================
  // Internal
  // ============================================

  /** Determine platform with feishu included (#2) */
  private determinePlatform(specifiedPlatform?: string): MessagePlatform {
    if (specifiedPlatform && VALID_PLATFORMS.includes(specifiedPlatform as MessagePlatform)) {
      return specifiedPlatform as MessagePlatform
    }
    return agentService.getRecentReplyPlatform()
  }

  /** LLM evaluation with retry on failure (#6) */
  private async evaluateWithRetry(
    context: InvokeRequest['context'],
    data: InvokeRequest['data']
  ): Promise<{
    success: boolean
    decision?: { shouldNotify: boolean; reason: string; message?: string }
    error?: string
  }> {
    const evalContext: EvaluationContext = {
      userRequest: context.userRequest,
      expectation: context.expectation
    }
    const evalData: EvaluationData = {
      summary: data.summary,
      details: data.details,
      timestamp: data.timestamp,
      metadata: data.metadata
    }

    for (let attempt = 0; attempt <= INVOKE_MAX_RETRIES; attempt++) {
      try {
        const result = await agentService.evaluate(evalContext, evalData)

        if (result.success && result.decision) {
          return result
        }

        // If this was the last attempt, return the error
        if (attempt === INVOKE_MAX_RETRIES) {
          return result
        }

        console.warn(`[Invoke] Evaluation failed (attempt ${attempt + 1}/${INVOKE_MAX_RETRIES + 1}): ${result.error}`)
        await this.delay(INVOKE_RETRY_DELAY_MS)
      } catch (error) {
        if (attempt === INVOKE_MAX_RETRIES) {
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error)
          }
        }
        console.warn(`[Invoke] Evaluation error (attempt ${attempt + 1}): ${error}`)
        await this.delay(INVOKE_RETRY_DELAY_MS)
      }
    }

    return { success: false, error: 'All retry attempts exhausted' }
  }

  /** Send notification via platform */
  private async sendNotification(
    platform: MessagePlatform,
    message: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      switch (platform) {
        case 'telegram': {
          let chatId = telegramBotService.getCurrentChatId()
          if (!chatId) {
            const boundUsers = await securityService.getBoundUsers('telegram')
            if (boundUsers.length > 0) chatId = boundUsers[0].userId
          }
          if (!chatId) return { success: false, error: 'No Telegram chat available' }
          return await telegramBotService.sendText(chatId, message)
        }

        case 'discord': {
          const channelId = discordBotService.getCurrentChannelId()
          if (channelId) return await discordBotService.sendText(channelId, message)
          const discordBound = await securityService.getBoundUsers('discord')
          if (discordBound.length > 0) {
            return await discordBotService.sendDMToUser(discordBound[0].uniqueId, message)
          }
          return { success: false, error: 'No Discord channel available' }
        }

        case 'slack': {
          const slackChannel = slackBotService.getCurrentChannelId()
          if (slackChannel) return await slackBotService.sendText(slackChannel, message)
          const slackBound = await securityService.getBoundUsers('slack')
          if (slackBound.length > 0) {
            return await slackBotService.sendDMToUser(slackBound[0].uniqueId, message)
          }
          return { success: false, error: 'No Slack channel available' }
        }

        case 'whatsapp': {
          const chatId = whatsappBotService.getCurrentChatId()
          if (!chatId) return { success: false, error: 'No active WhatsApp chat' }
          return await whatsappBotService.sendText(chatId, message)
        }

        case 'line': {
          const source = lineBotService.getCurrentSource()
          if (!source.id) return { success: false, error: 'No active Line chat' }
          return await lineBotService.sendText(source.id, message)
        }

        case 'feishu': {
          let chatId = feishuBotService.getCurrentChatId()
          if (!chatId) {
            const boundUsers = await securityService.getBoundUsers('feishu')
            if (boundUsers.length > 0) chatId = boundUsers[0].uniqueId
          }
          if (!chatId) return { success: false, error: 'No Feishu chat available' }
          return await feishuBotService.sendText(chatId, message)
        }

        default:
          return { success: false, error: `Unsupported platform: ${platform}` }
      }
    } catch (error) {
      console.error(`[Invoke] Notification error via ${platform}:`, error)
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms))
  }
}

/** Singleton instance */
export const invokeService = new InvokeService()
