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
   * Get current chat ID
   */
  getCurrentChatId(): string | null {
    return this.currentChatId
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
          
          // Display QR code in terminal for user-friendly access
          console.log('\n===========================================')
          console.log('   WhatsApp QR Code - Scan with your phone')
          console.log('===========================================\n')
          console.log('QR Code (copy this string):')
          console.log(qr)
          console.log('\n===========================================')
          console.log('   Open WhatsApp > Settings > Linked Devices')
          console.log('   Point your phone at this QR code to link')
          console.log('===========================================\n')
          
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
            isConnected: false
          }
          this.connectionStatus = {
            state: 'disconnected'
          }
          this.qrCode = null
          
          appEvents.emitWhatsAppStatusChanged({
            platform: 'whatsapp',
            isConnected: false
          })
          
          if (shouldReconnect) {
            console.log('[WhatsApp] Reconnecting...')
            await this.connect()
          }
        }

        if (connection === 'open') {
          // Connection successful
          console.log('[WhatsApp] Connected successfully!')
          
          this.status = {
            platform: 'whatsapp',
            isConnected: true
          }
          this.connectionStatus = {
            state: 'connected'
          }
          this.qrCode = null
          
          appEvents.emitWhatsAppStatusChanged({
            platform: 'whatsapp',
            isConnected: true
          })
        }
      })

      // Handle incoming messages
      this.socket.ev.on('messages.upsert', async ({ messages }: { messages: WAMessage[] }) => {
        for (const message of messages) {
          if (message.key.fromMe) continue // Skip own messages
          
          try {
            const chatId = message.key.remoteJid || ''
            const text = message.message?.conversation || message.message?.extendedTextMessage?.text || ''
            
            if (chatId && text) {
              console.log('[WhatsApp] Message from', chatId, ':', text)
              
              // Store message
              await whatsappStorage.addMessage({
                id: message.key.id || '',
                chatId,
                text,
                fromMe: false,
                timestamp: Date.now()
              })
              
              // Process with agent
              await this.processMessage(chatId, text)
            }
          } catch (error) {
            console.error('[WhatsApp] Error processing message:', error)
          }
        }
      })

    } catch (error) {
      console.error('[WhatsApp] Connection error:', error)
      this.connectionStatus = {
        state: 'disconnected'
      }
      throw error
    }
  }

  /**
   * Disconnect from WhatsApp
   */
  async disconnect(): Promise<void> {
    if (this.socket) {
      await this.socket.end(undefined)
      this.socket = null
      this.status = {
        platform: 'whatsapp',
        isConnected: false
      }
      this.connectionStatus = {
        state: 'disconnected'
      }
      this.qrCode = null
      console.log('[WhatsApp] Disconnected')
      
      appEvents.emitWhatsAppStatusChanged({
        platform: 'whatsapp',
        isConnected: false
      })
    }
  }

  /**
   * Get connection status
   */
  getStatus(): BotStatus {
    return this.status
  }

  /**
   * Get QR code
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
   * Send text message
   */
  async sendText(chatId: string, text: string): Promise<void> {
    if (!this.socket) {
      throw new Error('WhatsApp not connected')
    }
    
    await this.socket.sendMessage(chatId, { text })
    
    // Store message
    await whatsappStorage.addMessage({
      id: Date.now().toString(),
      chatId,
      text,
      fromMe: true,
      timestamp: Date.now()
    })
  }

  /**
   * Send image message
   */
  async sendImage(chatId: string, image: Buffer | string, caption?: string): Promise<void> {
    if (!this.socket) {
      throw new Error('WhatsApp not connected')
    }
    
    const imageBuffer = typeof image === 'string' ? Buffer.from(image, 'base64') : image
    
    await this.socket.sendMessage(chatId, {
      image: imageBuffer,
      caption: caption
    })
  }

  /**
   * Send document message
   */
  async sendDocument(chatId: string, document: Buffer | string, filename: string): Promise<void> {
    if (!this.socket) {
      throw new Error('WhatsApp not connected')
    }
    
    const documentBuffer = typeof document === 'string' ? Buffer.from(document, 'base64') : document
    
    await this.socket.sendMessage(chatId, {
      document: documentBuffer,
      mimetype: 'application/octet-stream',
      fileName: filename
    })
  }

  /**
   * Send location message
   */
  async sendLocation(chatId: string, latitude: number, longitude: number, description?: string): Promise<void> {
    if (!this.socket) {
      throw new Error('WhatsApp not connected')
    }
    
    await this.socket.sendMessage(chatId, {
      location: {
        degreesLatitude: latitude,
        degreesLongitude: longitude
      }
    })
  }

  /**
   * Get messages for a chat
   */
  async getMessages(chatId: string, limit: number = 50): Promise<StoredWhatsAppMessage[]> {
    return await whatsappStorage.getMessages(chatId, limit)
  }

  /**
   * Clear messages for a chat
   */
  async clearMessages(chatId: string): Promise<void> {
    await whatsappStorage.clearMessages(chatId)
  }

  /**
   * Process message with agent
   */
  private async processMessage(chatId: string, text: string): Promise<void> {
    try {
      // Set current chat ID
      this.currentChatId = chatId
      
      // Process with agent
      const response = await agentService.processMessage(text, 'whatsapp')
      
      // Send response
      if (response) {
        await this.sendText(chatId, response)
      }
    } catch (error) {
      console.error('[WhatsApp] Error processing message with agent:', error)
    }
  }
}

// Export singleton instance
export const whatsappBotService = new WhatsAppBotService()
