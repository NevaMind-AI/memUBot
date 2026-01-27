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
export type AppEventType = 'telegram:new-message' | 'telegram:status-changed' | 'llm:status-changed'

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
   * Emit status changed event
   */
  emitStatusChanged(status: { platform: string; isConnected: boolean }): void {
    console.log('[Events] Emitting status changed:', status)
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
}

// Export singleton instance
export const appEvents = new AppEventEmitter()
