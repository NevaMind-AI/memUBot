import { app } from 'electron'
import * as fs from 'fs/promises'
import * as path from 'path'
import { whatsappStorage } from './storage'
import { agentService } from '../../services/agent.service'
import { infraService } from '../../services/infra.service'
import { securityService } from '../../services/security.service'
import { appEvents } from '../../events'
import type { BotStatus, AppMessage } from '../types'
import type { StoredWhatsAppMessage, WhatsAppConnectionStatus, WhatsAppMessage } from './types'

// Baileys imports
import makeWASocket, { DisconnectReason, useMultiFileAuthState, fetchLatestBaileysVersion } from '@whiskeysockets/baileys'
import type { WASocket, ConnectionState, WAMessage, proto } from '@whiskeysockets/baileys'
import pino from 'pino'

/**
 * WhatsAppBotService manages WhatsApp connection and message handling
 * Uses Baileys library for WhatsApp Web protocol
 */
export class WhatsAppBotService {
  private status: BotStatus = {
    platform: 'whatsapp',
    isConnected: false
  }
  private connectionStatus: WhatsAppConnectionStatus = {
    state: 'disconnected'
  }
  private currentChatId: string | null = null
  private qrCode: string | null = null
  private socket: WASocket | null = null
  private logger: pino.Logger

  constructor() {
    this.logger = pino({
      level: 'silent' // Set to 'debug' for more logs
    })
  }

  /**
   * Connect to WhatsApp
   * Generates QR code for authentication
   */
  async connect(): Promise<void> {
    try {
      console.log('[WhatsApp] Starting connection...')

      // Initialize storage
      await whatsappStorage.initialize()
      console.log('[WhatsApp] Storage initialized')

      this.connectionStatus = {
        state: 'connecting'
      }

      // Get auth state from storage
      const authState = await useMultiFileAuthState(whatsappStorage.getSessionPath())

      // Get latest Baileys version
      const { version } = await fetchLatestBaileysVersion()
      console.log('[WhatsApp] Using Baileys version:', version)

      // Create socket
      this.socket = makeWASocket({
        version,
        logger: this.logger,
        auth: authState.state,
        printQRInTerminal: false,
        browser: ['2501-Bot', 'Chrome', '1.0.0'],
        connectTimeoutMs: 60000,
        keepAliveIntervalMs: 25000,
        markOnlineOnConnect: true,
        syncFullHistory: false,
        generateHighQualityLinkPreview: true,
      })

      // Handle connection updates
      this.socket.ev.on('connection.update', async (update: Partial<ConnectionState>) => {
        const { connection, lastDisconnect, qr } = update

        if (qr) {
          // QR code received
          this.qrCode = qr
          this.connectionStatus = {
            state: 'qr',
            qrCode: qr
          }
          console.log('[WhatsApp] QR code generated')
          appEvents.emitWhatsAppStatusChanged({
            platform: 'whatsapp',
            isConnected: false,
            qrCode: qr
          })
        }

        if (connection === 'close') {
          // Connection closed
          const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut
          console.log('[WhatsApp] Connection closed. Should reconnect:', shouldReconnect)
          
          this.status = {
            platform: 'whatsapp',
            isConnected: false,
            error: lastDisconnect?.error?.message
          }
          this.connectionStatus = {
            state: 'disconnected',
            error: lastDisconnect?.error?.message
          }
          appEvents.emitWhatsAppStatusChanged(this.status)

          if (shouldReconnect) {
            console.log('[WhatsApp] Reconnecting...')
            await this.connect()
          }
        } else if (connection === 'open') {
          // Connection established
          this.status = {
            platform: 'whatsapp',
            isConnected: true
          }
          this.connectionStatus = {
            state: 'connected'
          }
          this.qrCode = null
          console.log('[WhatsApp] Connected successfully')
          appEvents.emitWhatsAppStatusChanged(this.status)
        }
      })

      // Handle incoming messages
      this.socket.ev.on('messages.upsert', async ({ messages, type }) => {
        console.log('[WhatsApp] Received messages:', messages.length, 'type:', type)
        
        for (const message of messages) {
          if (message.key.fromMe) continue // Skip own messages
          
          await this.handleIncomingMessage(message)
        }
      })

      // Save auth state on update
      this.socket.ev.on('creds.update', authState.saveState)

      console.log('[WhatsApp] Socket created, waiting for connection...')
    } catch (error) {
      console.error('[WhatsApp] Connection error:', error)
      this.status = {
        platform: 'whatsapp',
        isConnected: false,
        error: error instanceof Error ? error.message : String(error)
      }
      appEvents.emitWhatsAppStatusChanged(this.status)
      throw error
    }
  }

  /**
   * Disconnect from WhatsApp
   */
  async disconnect(): Promise<void> {
    if (this.socket) {
      await this.socket.end()
      this.socket = null
    }
    this.status = {
      platform: 'whatsapp',
      isConnected: false
    }
    this.connectionStatus = {
      state: 'disconnected'
    }
    this.qrCode = null
    appEvents.emitWhatsAppStatusChanged(this.status)
    console.log('[WhatsApp] Disconnected')
  }

  /**
   * Get current QR code for authentication
   */
  getQRCode(): string | null {
    return this.qrCode
  }

  /**
   * Get connection status
   */
  getConnectionStatus(): WhatsAppConnectionStatus {
    return this.connectionStatus
  }

  /**
   * Get bot status
   */
  getStatus(): BotStatus {
    return this.status
  }

  /**
   * Send a message
   */
  async sendMessage(chatId: string, text: string): Promise<void> {
    if (!this.socket) {
      throw new Error('WhatsApp not connected')
    }
    
    try {
      const result = await this.socket.sendMessage(chatId, { text })
      console.log('[WhatsApp] Message sent:', result.key.id)
    } catch (error) {
      console.error('[WhatsApp] Error sending message:', error)
      throw error
    }
  }

  /**
   * Handle incoming message
   */
  private async handleIncomingMessage(message: proto.IWebMessageInfo): Promise<void> {
    try {
      const from = message.key.remoteJid || ''
      const body = message.message?.conversation || 
                   message.message?.extendedTextMessage?.text || 
                   ''
      
      console.log('[WhatsApp] Message from:', from, 'body:', body)
      
      // Store message
      const storedMessage: StoredWhatsAppMessage = {
        id: message.key.id || '',
        from: from,
        to: 'me',
        body: body,
        timestamp: message.messageTimestamp || Date.now(),
        fromMe: message.key.fromMe || false,
        hasMedia: false
      }
      await whatsappStorage.storeMessage(storedMessage)
      
      // Process with agent
      if (body && !message.key.fromMe) {
        const response = await agentService.processMessage({
          platform: 'whatsapp',
          chatId: from,
          text: body,
          userId: from
        })

        if (response) {
          await this.sendMessage(from, response)
        }
      }
    } catch (error) {
      console.error('[WhatsApp] Error handling message:', error)
    }
  }

  /**
   * Get message history
   */
  async getMessages(chatId: string, limit: number = 50): Promise<StoredWhatsAppMessage[]> {
    return await whatsappStorage.getMessages(chatId, limit)
  }

  /**
   * Clear message history
   */
  async clearMessages(chatId?: string): Promise<void> {
    await whatsappStorage.clearMessages(chatId)
  }
}

// Export singleton instance
export const whatsappBotService = new WhatsAppBotService()
