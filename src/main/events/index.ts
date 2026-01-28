import { EventEmitter } from 'events'
import { BrowserWindow } from 'electron'
import type { AppMessage } from '../apps/types'

/**
 * LLM status info type
 */
export interface LLMStatusInfo {
  status: 'idle' | 'thinking' | 'tool_executing'
  currentTool?: string
  iteration?: number
}

/**
 * Event types for the application
 */
export type AppEventType =
  | 'telegram:new-message'
  | 'telegram:status-changed'
  | 'discord:new-message'
  | 'discord:status-changed'
  | 'whatsapp:new-message'
  | 'whatsapp:status-changed'
  | 'slack:new-message'
  | 'slack:status-changed'
  | 'line:new-message'
  | 'line:status-changed'
  | 'llm:status-changed'

/**
 * Application event emitter
 * Used to communicate between services and send events to renderer
 */
class AppEventEmitter extends EventEmitter {
  /**
   * Send event to all renderer windows
   */
  sendToRenderer(channel: string, data: unknown): void {
    const windows = BrowserWindow.getAllWindows()
    for (const win of windows) {
      if (!win.isDestroyed()) {
        win.webContents.send(channel, data)
      }
    }
  }

  /**
   * Emit new message event
   */
  emitNewMessage(message: AppMessage): void {
    console.log('[Events] Emitting new message:', message.id)
    this.emit('telegram:new-message', message)
    this.sendToRenderer('telegram:new-message', message)
  }

  /**
   * Emit Telegram status changed event
   */
  emitTelegramStatusChanged(status: {
    platform: string
    isConnected: boolean
    username?: string
    botName?: string
    avatarUrl?: string
    error?: string
  }): void {
    console.log('[Events] Emitting Telegram status changed:', status)
    this.emit('telegram:status-changed', status)
    this.sendToRenderer('telegram:status-changed', status)
  }

  /**
   * Emit LLM status changed event
   */
  emitLLMStatusChanged(status: LLMStatusInfo): void {
    console.log('[Events] Emitting LLM status changed:', status)
    this.emit('llm:status-changed', status)
    this.sendToRenderer('llm:status-changed', status)
  }

  /**
   * Emit Discord new message event
   */
  emitDiscordNewMessage(message: AppMessage): void {
    console.log('[Events] Emitting Discord new message:', message.id)
    this.emit('discord:new-message', message)
    this.sendToRenderer('discord:new-message', message)
  }

  /**
   * Emit Discord status changed event
   */
  emitDiscordStatusChanged(status: {
    platform: string
    isConnected: boolean
    username?: string
    botName?: string
    avatarUrl?: string
    error?: string
  }): void {
    console.log('[Events] Emitting Discord status changed:', status)
    this.emit('discord:status-changed', status)
    this.sendToRenderer('discord:status-changed', status)
  }

  /**
   * Emit WhatsApp new message event
   */
  emitWhatsAppNewMessage(message: AppMessage): void {
    console.log('[Events] Emitting WhatsApp new message:', message.id)
    this.emit('whatsapp:new-message', message)
    this.sendToRenderer('whatsapp:new-message', message)
  }

  /**
   * Emit WhatsApp status changed event
   */
  emitWhatsAppStatusChanged(status: {
    platform: string
    isConnected: boolean
    username?: string
    botName?: string
    avatarUrl?: string
    error?: string
  }): void {
    console.log('[Events] Emitting WhatsApp status changed:', status)
    this.emit('whatsapp:status-changed', status)
    this.sendToRenderer('whatsapp:status-changed', status)
  }

  /**
   * Emit Slack new message event
   */
  emitSlackNewMessage(message: AppMessage): void {
    console.log('[Events] Emitting Slack new message:', message.id)
    this.emit('slack:new-message', message)
    this.sendToRenderer('slack:new-message', message)
  }

  /**
   * Emit Slack status changed event
   */
  emitSlackStatusChanged(status: {
    platform: string
    isConnected: boolean
    username?: string
    botName?: string
    avatarUrl?: string
    error?: string
  }): void {
    console.log('[Events] Emitting Slack status changed:', status)
    this.emit('slack:status-changed', status)
    this.sendToRenderer('slack:status-changed', status)
  }

  /**
   * Emit Line new message event
   */
  emitLineNewMessage(message: AppMessage): void {
    console.log('[Events] Emitting Line new message:', message.id)
    this.emit('line:new-message', message)
    this.sendToRenderer('line:new-message', message)
  }

  /**
   * Emit Line status changed event
   */
  emitLineStatusChanged(status: {
    platform: string
    isConnected: boolean
    username?: string
    botName?: string
    avatarUrl?: string
    error?: string
  }): void {
    console.log('[Events] Emitting Line status changed:', status)
    this.emit('line:status-changed', status)
    this.sendToRenderer('line:status-changed', status)
  }
}

// Export singleton instance
export const appEvents = new AppEventEmitter()
