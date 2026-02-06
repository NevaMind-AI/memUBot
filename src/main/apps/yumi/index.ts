/**
 * Yumi app module
 *
 * Exports the bot service, storage, and utility functions for Yumi message handling.
 */

import type { AppMessage } from '../types'
import type { StoredYumiMessage } from './types'

export { yumiBotService, YumiBotService } from './bot.service'
export { yumiStorage } from './storage'
export type { StoredYumiMessage, YumiMessageType } from './types'

/**
 * Convert a StoredYumiMessage to the shared AppMessage format
 */
export function convertToAppMessage(msg: StoredYumiMessage): AppMessage {
  return {
    id: msg.messageId,
    platform: 'yumi',
    chatId: msg.chatId,
    senderId: msg.senderId,
    senderName: msg.senderName,
    content: msg.content,
    timestamp: new Date(msg.timestamp),
    isFromBot: msg.isFromBot
  }
}
