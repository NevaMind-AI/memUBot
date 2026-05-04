import {
  infraService,
  type IncomingMessageEvent,
  type OutgoingMessageEvent,
} from './infra.service'
import { memorizationStorage, type StoredUnmemorizedMessage } from './memorization.storage'
import { loadSettings } from '../config/settings.config'
import type { MemoryProvider } from './memory/memory-provider'
import { RemoteMemuProvider } from './memory/remote-memu.provider'
import { LocalControlledMemoryProvider } from './memory/local-controlled-memory.provider'

const CHAT_MEMORIZE_MESSAGE_THRESHOLD = 20
const CHAT_MEMORIZE_TIME_THRESHOLD_MS = 60 * 60 * 1000 // 60 minutes

const MEMORIZE_MIN_MESSAGE_COUNT = 2
const MEMORIZE_MAX_MESSAGE_COUNT = 200

class MemorizationService {
  private unsubscribers: (() => void)[] = []
  private isMemorizing = false
  private debounceTimer: ReturnType<typeof setTimeout> | null = null
  private readonly remoteMemoryProvider = new RemoteMemuProvider()
  private readonly localMemoryProvider = new LocalControlledMemoryProvider()

  private async getMemoryProvider(): Promise<MemoryProvider> {
    const settings = await loadSettings()
    const hasRemoteConfiguration = !!(
      settings.memuApiKey && settings.memuApiKey.trim() &&
      settings.memuBaseUrl && settings.memuBaseUrl.trim() &&
      settings.memuUserId && settings.memuUserId.trim() &&
      settings.memuAgentId && settings.memuAgentId.trim()
    )
    return hasRemoteConfiguration ? this.remoteMemoryProvider : this.localMemoryProvider
  }

  // ==================== Lifecycle ====================

  async start(): Promise<boolean> {
    await memorizationStorage.initialize()

    const provider = await this.getMemoryProvider()
    const isRemote = provider.kind === 'remote-memu'

    if (!isRemote) {
      console.log('[Memorization] Remote memU not configured, using local controlled memory provider')
    }

    if (isRemote && (await provider.isConfigured())) {
      await this.recoverPendingTask(provider)
    }

    await this.checkAndTrigger()

    this.unsubscribers.push(
      infraService.subscribe('message:incoming', (event) => {
        this.handleMessage(event, 'incoming')
      })
    )
    this.unsubscribers.push(
      infraService.subscribe('message:outgoing', (event) => {
        this.handleMessage(event, 'outgoing')
      })
    )

    console.log('[Memorization] Service started')
    return true
  }

  stop(): void {
    this.unsubscribers.forEach((unsub) => unsub())
    this.unsubscribers = []
    this.clearDebounceTimer()
    console.log('[Memorization] Service stopped')
  }

  private handleMessage(
    event: IncomingMessageEvent | OutgoingMessageEvent,
    _direction: 'incoming' | 'outgoing'
  ): void {
    void this.handleMessageAsync(event)
  }

  private async handleMessageAsync(event: IncomingMessageEvent | OutgoingMessageEvent): Promise<void> {
    if (event.platform === 'none') return

    const provider = await this.getMemoryProvider()
    if (provider.kind === 'local-controlled-memory') {
      const localStatus = await this.localMemoryProvider.getCaptureStatus()
      if (localStatus.paused) {
        return
      }
    }

    const content =
      typeof event.message.content === 'string'
        ? event.message.content
        : JSON.stringify(event.message.content)

    const stored: StoredUnmemorizedMessage = {
      platform: event.platform,
      role: event.message.role,
      content,
      timestamp: event.timestamp,
    }

    await memorizationStorage.appendMessage(stored)
    console.log(
      `[Memorization] Queued message from ${event.platform} (queue size: ~${stored.timestamp})`
    )
    await this.checkAndTrigger()
  }

  private async checkAndTrigger(): Promise<void> {
    const provider = await this.getMemoryProvider()

    if (this.isMemorizing) {
      await this.checkActiveTask(provider)
      if (this.isMemorizing) return
    }

    const count = await memorizationStorage.getMessageCount()
    if (count === 0) return

    if (count >= CHAT_MEMORIZE_MESSAGE_THRESHOLD) {
      console.log(
        `[Memorization] Message count ${count} >= threshold ${CHAT_MEMORIZE_MESSAGE_THRESHOLD}, triggering immediately`
      )
      this.clearDebounceTimer()
      this.triggerMemorization()
      return
    }

    if (count >= MEMORIZE_MIN_MESSAGE_COUNT) {
      this.resetDebounceTimer()
    }
  }

  private resetDebounceTimer(): void {
    this.clearDebounceTimer()
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null
      console.log('[Memorization] Debounce timer fired, triggering memorization')
      this.triggerMemorization()
    }, CHAT_MEMORIZE_TIME_THRESHOLD_MS)
  }

  private clearDebounceTimer(): void {
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = null
    }
  }

  private async resolveTaskStatus(
    provider: MemoryProvider,
    taskId: string,
    messageCount: number
  ): Promise<'success' | 'failure' | 'pending' | 'error'> {
    try {
      const result = await provider.checkTaskStatus(taskId, messageCount)
      return result.status
    } catch (error) {
      console.error(`[Memorization] Error checking task ${taskId}:`, error)
      return 'error'
    }
  }

  private async finalizeResolvedTask(
    outcome: 'success' | 'failure' | 'error',
    messageCount: number
  ): Promise<void> {
    if (outcome === 'success' && messageCount > 0) {
      await memorizationStorage.removeFirstN(messageCount)
      await memorizationStorage.updateFirstMessageTimestamp()
    }

    await memorizationStorage.clearTaskState()
    this.isMemorizing = false
  }

  private async checkActiveTask(provider: MemoryProvider): Promise<void> {
    if (!(await provider.isConfigured())) return

    const state = await memorizationStorage.getState()
    if (!state.lastTaskId) {
      this.isMemorizing = false
      return
    }

    const outcome = await this.resolveTaskStatus(
      provider,
      state.lastTaskId,
      state.messagesToRemoveOnSuccess
    )

    if (outcome === 'success' || outcome === 'failure' || outcome === 'error') {
      await this.finalizeResolvedTask(outcome, state.messagesToRemoveOnSuccess)
    }
  }

  private triggerMemorization(): void {
    if (this.isMemorizing) return
    this.isMemorizing = true
    this.runMemorization().catch((error) => {
      console.error('[Memorization] Memorization failed:', error)
      this.isMemorizing = false
    })
  }

  private async runMemorization(): Promise<void> {
    try {
      const provider = await this.getMemoryProvider()
      if (!(await provider.isConfigured())) {
        console.log('[Memorization] No available memory provider configured')
        this.isMemorizing = false
        return
      }

      const allMessages = await memorizationStorage.getMessages()

      if (allMessages.length < MEMORIZE_MIN_MESSAGE_COUNT) {
        console.log('[Memorization] Not enough messages to memorize')
        this.isMemorizing = false
        return
      }

      const messages = allMessages.slice(0, MEMORIZE_MAX_MESSAGE_COUNT)
      const { taskId, messageCount } = await provider.startMemorization(messages)

      if (!taskId) {
        if (provider.kind === 'local-controlled-memory' && messageCount > 0) {
          await memorizationStorage.removeFirstN(messageCount)
          await memorizationStorage.clearTaskState()
          await memorizationStorage.updateFirstMessageTimestamp()
        } else if (provider.kind === 'remote-memu') {
          console.warn('[Memorization] Remote memorization did not start; falling back to local controlled memory')
          const fallbackResult = await this.localMemoryProvider.startMemorization(messages)
          if (fallbackResult.messageCount > 0) {
            await memorizationStorage.removeFirstN(fallbackResult.messageCount)
            await memorizationStorage.updateFirstMessageTimestamp()
          }
          await memorizationStorage.clearTaskState()
        }
        this.isMemorizing = false
        return
      }

      await memorizationStorage.setState({
        lastTaskId: taskId,
        messagesToRemoveOnSuccess: messageCount,
      })
    } catch (error) {
      console.error('[Memorization] Error in runMemorization:', error)
      this.isMemorizing = false
    }
  }

  private async recoverPendingTask(provider: MemoryProvider): Promise<void> {
    if (!(await provider.isConfigured())) return

    const state = await memorizationStorage.getState()
    if (!state.lastTaskId) return

    console.log(
      `[Memorization] Recovering pending task: ${state.lastTaskId} (${state.messagesToRemoveOnSuccess} messages)`
    )

    this.isMemorizing = true

    const outcome = await this.resolveTaskStatus(
      provider,
      state.lastTaskId,
      state.messagesToRemoveOnSuccess
    )

    if (outcome === 'success' || outcome === 'failure' || outcome === 'error') {
      await this.finalizeResolvedTask(outcome, state.messagesToRemoveOnSuccess)
      return
    }

    console.log('[Memorization] Recovered task still pending, will check again lazily')
  }
}

export const memorizationService = new MemorizationService()
