import { EventEmitter } from 'events'
import type Anthropic from '@anthropic-ai/sdk'

// ==================== Types ====================

/**
 * Supported platforms for messaging
 */
export type MessagePlatform = 'telegram' | 'discord' | 'slack' | 'whatsapp' | 'line' | 'feishu' | 'yumi' | 'none'

/**
 * Event types for the infra bus
 */
export type InfraEventType =
  | 'message:incoming'    // New user message received from any platform
  | 'message:outgoing'    // Bot response sent to a platform
  | 'message:processed'   // Message processed by agent (after response)

/**
 * Incoming message event payload
 * Published when a new user message is received from any platform
 */
export interface IncomingMessageEvent {
  platform: MessagePlatform
  timestamp: number  // Unix timestamp in seconds
  message: Anthropic.MessageParam
  metadata?: {
    userId?: string
    chatId?: string
    messageId?: string
    imageUrls?: string[]
    [key: string]: unknown
  }
}

/**
 * Outgoing message event payload
 * Published when the bot sends a response to a platform
 */
export interface OutgoingMessageEvent {
  platform: MessagePlatform
  timestamp: number  // Unix timestamp in seconds
  message: Anthropic.MessageParam
  metadata?: {
    messageId?: string
    replyToId?: string
    [key: string]: unknown
  }
}

/**
 * Processed message event payload
 * Published after the agent has finished processing a message
 */
export interface ProcessedMessageEvent {
  platform: MessagePlatform
  timestamp: number
  originalMessage: Anthropic.MessageParam
  response: string
  success: boolean
}

/**
 * Type-safe event payload map
 */
export interface InfraEventPayloads {
  'message:incoming': IncomingMessageEvent
  'message:outgoing': OutgoingMessageEvent
  'message:processed': ProcessedMessageEvent
}

/**
 * Typed listener function
 */
export type InfraEventListener<T extends InfraEventType> = (
  payload: InfraEventPayloads[T]
) => void | Promise<void>

// ==================== Service ====================

/**
 * InfraService - Centralized message bus for inter-service communication
 *
 * This service provides a publish-subscribe pattern for services to communicate
 * without tight coupling. Platforms publish messages, other services subscribe.
 *
 * Usage:
 * - Platforms call `infraService.publish('message:incoming', payload)` when receiving messages
 * - Services call `infraService.subscribe('message:incoming', handler)` to receive messages
 * - The subscribe method returns an unsubscribe function for cleanup
 *
 * Example:
 * ```typescript
 * // Publishing (in platform bot service)
 * infraService.publish('message:incoming', {
 *   platform: 'discord',
 *   timestamp: Math.floor(Date.now() / 1000),
 *   message: { role: 'user', content: 'Hello' }
 * })
 *
 * // Subscribing (in proactive service)
 * const unsubscribe = infraService.subscribe('message:incoming', (event) => {
 *   console.log('New message from', event.platform)
 * })
 *
 * // Cleanup
 * unsubscribe()
 * ```
 */
class InfraService extends EventEmitter {
  // Buffer for late subscribers or recovery scenarios
  private messageBuffer: Map<InfraEventType, unknown[]> = new Map()
  private readonly bufferSize = 100

  constructor() {
    super()
    // Increase max listeners for multiple subscribers
    this.setMaxListeners(20)

    // Initialize buffers for each event type
    this.messageBuffer.set('message:incoming', [])
    this.messageBuffer.set('message:outgoing', [])
    this.messageBuffer.set('message:processed', [])

    console.log('[Infra] Service initialized')
  }

  /**
   * Publish an event to all subscribers
   *
   * @param eventType - The type of event to publish
   * @param payload - The event payload (type-checked based on eventType)
   */
  publish<T extends InfraEventType>(
    eventType: T,
    payload: InfraEventPayloads[T]
  ): void {
    const platformInfo = 'platform' in payload ? ` from ${payload.platform}` : ''
    console.log(`[Infra] Publishing ${eventType}${platformInfo}`)

    // Add to buffer (circular buffer behavior)
    const buffer = this.messageBuffer.get(eventType)
    if (buffer) {
      buffer.push({ ...payload, _bufferedAt: Date.now() })
      if (buffer.length > this.bufferSize) {
        buffer.shift()
      }
    }

    // Emit to all listeners
    this.emit(eventType, payload)
  }

  /**
   * Subscribe to an event type
   *
   * @param eventType - The type of event to subscribe to
   * @param listener - The callback function to invoke when event is published
   * @returns Unsubscribe function - call this to stop listening
   */
  subscribe<T extends InfraEventType>(
    eventType: T,
    listener: InfraEventListener<T>
  ): () => void {
    this.on(eventType, listener)
    console.log(`[Infra] New subscriber for ${eventType}, total: ${this.listenerCount(eventType)}`)

    // Return unsubscribe function
    return () => {
      this.off(eventType, listener)
      console.log(`[Infra] Subscriber removed for ${eventType}, total: ${this.listenerCount(eventType)}`)
    }
  }

  /**
   * Subscribe with a filter function
   * Only calls listener when filter returns true
   *
   * @param eventType - The type of event to subscribe to
   * @param filter - Filter function to decide if listener should be called
   * @param listener - The callback function
   * @returns Unsubscribe function
   */
  subscribeWithFilter<T extends InfraEventType>(
    eventType: T,
    filter: (payload: InfraEventPayloads[T]) => boolean,
    listener: InfraEventListener<T>
  ): () => void {
    const filteredListener = (payload: InfraEventPayloads[T]) => {
      if (filter(payload)) {
        listener(payload)
      }
    }

    this.on(eventType, filteredListener)
    console.log(`[Infra] New filtered subscriber for ${eventType}, total: ${this.listenerCount(eventType)}`)

    return () => {
      this.off(eventType, filteredListener)
      console.log(`[Infra] Filtered subscriber removed for ${eventType}, total: ${this.listenerCount(eventType)}`)
    }
  }

  /**
   * Subscribe to messages from specific platforms only
   *
   * @param platforms - Array of platforms to listen for
   * @param listener - The callback function
   * @returns Unsubscribe function
   */
  subscribeToMultiplePlatforms(
    platforms: MessagePlatform[],
    listener: InfraEventListener<'message:incoming'>
  ): () => void {
    return this.subscribeWithFilter(
      'message:incoming',
      (payload) => platforms.includes(payload.platform),
      listener
    )
  }

  /**
   * Get buffered messages (for late subscribers or recovery)
   *
   * @param eventType - The type of events to retrieve
   * @param since - Optional unix timestamp - only return messages after this time
   * @returns Array of buffered payloads
   */
  getBufferedMessages<T extends InfraEventType>(
    eventType: T,
    since?: number
  ): InfraEventPayloads[T][] {
    const buffer = this.messageBuffer.get(eventType) || []
    if (since) {
      return buffer.filter((msg: unknown) => {
        const typedMsg = msg as { timestamp?: number }
        return typedMsg.timestamp && typedMsg.timestamp > since
      }) as InfraEventPayloads[T][]
    }
    return [...buffer] as InfraEventPayloads[T][]
  }

  /**
   * Clear message buffer
   *
   * @param eventType - Optional specific event type to clear, or all if not provided
   */
  clearBuffer(eventType?: InfraEventType): void {
    if (eventType) {
      this.messageBuffer.set(eventType, [])
      console.log(`[Infra] Cleared buffer for ${eventType}`)
    } else {
      for (const key of this.messageBuffer.keys()) {
        this.messageBuffer.set(key, [])
      }
      console.log('[Infra] Cleared all buffers')
    }
  }

  /**
   * Get the number of subscribers for an event type
   *
   * @param eventType - The event type to check
   * @returns Number of active subscribers
   */
  getSubscriberCount(eventType: InfraEventType): number {
    return this.listenerCount(eventType)
  }

  /**
   * Check if there are any subscribers for an event type
   *
   * @param eventType - The event type to check
   * @returns true if there are subscribers
   */
  hasSubscribers(eventType: InfraEventType): boolean {
    return this.listenerCount(eventType) > 0
  }

  /**
   * Try to consume user input by services that intercept messages before the main agent.
   *
   * Currently checks:
   * - Proactive service: if waiting for user input from the same platform
   *
   * @param message - The user message to process
   * @param platform - The platform the message came from
   * @returns true if the message was consumed (caller should return silently), false otherwise
   */
  async tryConsumeUserInput(
    message: string,
    platform: MessagePlatform
  ): Promise<boolean> {
    // Dynamic import to avoid circular dependency
    const { proactiveService } = await import('./proactive.service')

    // Check if proactive service is waiting for user input from this platform
    if (proactiveService.isWaitingForUserInput()) {
      const waitingPlatform = proactiveService.getWaitingPlatform()

      // Only consume if the platform matches
      if (waitingPlatform === platform) {
        console.log(`[Infra] Proactive service is waiting for user input from ${platform}, forwarding message`)
        proactiveService.setUserInput(message)
        return true
      }
    }

    // Add more service checks here in the future if needed
    // e.g., if (someOtherService.isWaitingForInput()) { ... }

    return false
  }
}

// Export singleton instance
export const infraService = new InfraService()
