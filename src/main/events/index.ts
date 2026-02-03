import { EventEmitter } from 'events'
import { BrowserWindow } from 'electron'
import type { AppMessage } from '../apps/types'
import type { AgentActivityItem } from '../services/agent/types'

/**
 * LLM status type
 * - idle: App started but never processed any message
 * - thinking: Currently processing, waiting for LLM response
 * - tool_executing: Currently executing a tool
 * - complete: Last request completed successfully
 * - aborted: Last request was aborted/interrupted
 */
export type LLMStatus = 'idle' | 'thinking' | 'tool_executing' | 'complete' | 'aborted'

/**
 * LLM status info type
 */
export interface LLMStatusInfo {
  status: LLMStatus
  currentTool?: string
  iteration?: number
}

// Re-export AgentActivityItem for convenience
export type { AgentActivityItem } from '../services/agent/types'

/**
 * Service status type
 */
export type ServiceStatusType = 'stopped' | 'running' | 'error'

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
  | 'feishu:new-message'
  | 'feishu:status-changed'
  | 'llm:status-changed'
  | 'llm:activity-changed'
  | 'service:status-changed'
  | 'service:list-changed'

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
   * Emit agent activity changed event
   */
  emitAgentActivityChanged(activity: AgentActivityItem): void {
    // Don't log full activity to avoid noise
    console.log(`[Events] Emitting agent activity: ${activity.type}${activity.toolName ? ` (${activity.toolName})` : ''}`)
    this.emit('llm:activity-changed', activity)
    this.sendToRenderer('llm:activity-changed', activity)
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

  /**
   * Emit Feishu new message event
   */
  emitFeishuNewMessage(message: AppMessage): void {
    console.log('[Events] Emitting Feishu new message:', message.id)
    this.emit('feishu:new-message', message)
    this.sendToRenderer('feishu:new-message', message)
  }

  /**
   * Emit Feishu status changed event
   */
  emitFeishuStatusChanged(status: {
    platform: string
    isConnected: boolean
    username?: string
    botName?: string
    avatarUrl?: string
    error?: string
  }): void {
    console.log('[Events] Emitting Feishu status changed:', status)
    this.emit('feishu:status-changed', status)
    this.sendToRenderer('feishu:status-changed', status)
  }

  /**
   * Emit service status changed event
   */
  emitServiceStatusChanged(serviceId: string, status: ServiceStatusType): void {
    console.log(`[Events] Emitting service status changed: ${serviceId} -> ${status}`)
    this.emit('service:status-changed', { serviceId, status })
    this.sendToRenderer('service:status-changed', { serviceId, status })
  }

  /**
   * Emit service list changed event (when services are created or deleted)
   */
  emitServiceListChanged(): void {
    console.log('[Events] Emitting service list changed')
    this.emit('service:list-changed', {})
    this.sendToRenderer('service:list-changed', {})
  }
}

// Export singleton instance
export const appEvents = new AppEventEmitter()
