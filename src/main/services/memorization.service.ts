import { loadSettings } from '../config/settings.config'
import {
  infraService,
  type IncomingMessageEvent,
  type OutgoingMessageEvent,
} from './infra.service'
import {
  memorizationStorage,
  type StoredUnmemorizedMessage,
} from './memorization.storage'

const CHAT_MEMORIZE_MESSAGE_THRESHOLD = 20
const CHAT_MEMORIZE_TIME_THRESHOLD_MS = 60 * 60 * 1000 // 60 minutes

const MEMORIZE_MIN_MESSAGE_COUNT = 2
const MEMORIZE_MAX_MESSAGE_COUNT = 200

const MEMORIZE_STATUS_POLL_INTERVAL_MS = 10_000
const MEMORIZE_MAX_WAIT_MS = 5 * 60 * 1000

type MemorizeStatus = 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'FAILURE'

interface MemorizeStatusResponse {
  task_id: string
  status: MemorizeStatus
  detail_info: string
}

class MemorizationService {
  private unsubscribers: (() => void)[] = []
  private isMemorizing = false
  private debounceTimer: ReturnType<typeof setTimeout> | null = null

  // ==================== Config ====================

  private async getMemuConfig() {
    const settings = await loadSettings()
    return {
      baseUrl: settings.memuBaseUrl,
      apiKey: settings.memuApiKey,
      userId: settings.memuUserId,
      agentId: settings.memuAgentId,
    }
  }

  // ==================== Lifecycle ====================

  private async isApiKeyConfigured(): Promise<boolean> {
    const settings = await loadSettings()
    return !!(settings.memuApiKey && settings.memuApiKey.trim())
  }

  async start(): Promise<boolean> {
    await memorizationStorage.initialize()

    const hasKey = await this.isApiKeyConfigured()
    if (!hasKey) {
      console.log('[Memorization] memuApiKey not configured, messages will be queued locally until key is set')
    }

    // Recover from previous run (only if API key is available)
    if (hasKey) {
      await this.recoverPendingTask()
    }

    // Check if memorization conditions are already met from persisted messages
    await this.checkAndTrigger()

    // Subscribe to both incoming and outgoing messages
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

  // ==================== Message handling ====================

  private handleMessage(
    event: IncomingMessageEvent | OutgoingMessageEvent,
    _direction: 'incoming' | 'outgoing'
  ): void {
    if (event.platform === 'none') return

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

    memorizationStorage.appendMessage(stored).then(() => {
      console.log(
        `[Memorization] Queued message from ${event.platform} (queue size: ~${stored.timestamp})`
      )
      this.checkAndTrigger()
    })
  }

  // ==================== Trigger logic ====================

  private async checkAndTrigger(): Promise<void> {
    // If a task is in-flight, do a single status check instead of blocking
    if (this.isMemorizing) {
      await this.checkActiveTask()
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

    // Count below threshold — use debounce timer
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

  // ==================== Task status helpers ====================

  /**
   * Fetch the status of a memorization task and handle storage cleanup
   * on terminal states (SUCCESS / FAILURE).
   *
   * Returns:
   *  - 'success'  — task completed, queued messages removed from storage
   *  - 'failure'  — task failed, task state cleared
   *  - 'pending'  — task still PENDING or PROCESSING
   *  - 'error'    — network / parse error (nothing changed)
   */
  private async resolveTaskStatus(
    taskId: string,
    messageCount: number
  ): Promise<'success' | 'failure' | 'pending' | 'error'> {
    try {
      const memuConfig = await this.getMemuConfig()
      const response = await fetch(
        `${memuConfig.baseUrl}/api/v3/memory/memorize/status/${taskId}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${memuConfig.apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      )

      if (!response.ok) {
        console.error(`[Memorization] Status check failed for ${taskId}: ${response.status}`)
        return 'error'
      }

      const result = (await response.json()) as MemorizeStatusResponse
      console.log(`[Memorization] Task ${taskId} status: ${result.status}`)

      if (result.status === 'SUCCESS') {
        await memorizationStorage.removeFirstN(messageCount)
        await memorizationStorage.clearTaskState()
        await memorizationStorage.updateFirstMessageTimestamp()
        return 'success'
      }

      if (result.status === 'FAILURE') {
        console.error(`[Memorization] Task ${taskId} failed: ${result.detail_info}`)
        await memorizationStorage.clearTaskState()
        return 'failure'
      }

      return 'pending'
    } catch (error) {
      console.error(`[Memorization] Error checking task ${taskId}:`, error)
      return 'error'
    }
  }

  /**
   * Single non-blocking status check for the current in-flight task.
   * Called lazily from checkAndTrigger so we only hit the server when a
   * new message arrives or the debounce timer fires.
   */
  private async checkActiveTask(): Promise<void> {
    if (!(await this.isApiKeyConfigured())) return

    const state = await memorizationStorage.getState()
    if (!state.lastTaskId) {
      this.isMemorizing = false
      return
    }

    const outcome = await this.resolveTaskStatus(
      state.lastTaskId,
      state.messagesToRemoveOnSuccess
    )

    if (outcome === 'success' || outcome === 'failure') {
      this.isMemorizing = false
    }
    // 'pending' / 'error' — keep isMemorizing true, will retry on next call
  }

  // ==================== Memorization execution ====================

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
      if (!(await this.isApiKeyConfigured())) {
        console.log('[Memorization] memuApiKey not configured, skipping memorize POST (messages remain queued)')
        this.isMemorizing = false
        return
      }

      const memuConfig = await this.getMemuConfig()
      const allMessages = await memorizationStorage.getMessages()

      if (allMessages.length < MEMORIZE_MIN_MESSAGE_COUNT) {
        console.log('[Memorization] Not enough messages to memorize, skipping memorize POST (messages remain queued)')
        this.isMemorizing = false
        return
      }

      const messages = allMessages.slice(0, MEMORIZE_MAX_MESSAGE_COUNT)
      const messageCount = messages.length

      const formattedMessages = messages.map((m) => ({
        role: m.role,
        content: `[${m.platform}] ${m.content}`,
      }))

      console.log(
        `[Memorization] Sending ${formattedMessages.length} messages to memorize`
      )

      const response = await fetch(
        `${memuConfig.baseUrl}/api/v3/memory/memorize`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${memuConfig.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            user_id: memuConfig.userId,
            agent_id: memuConfig.agentId,
            conversation: formattedMessages,
          }),
        }
      )

      if (!response.ok) {
        console.error(
          '[Memorization] API returned status:',
          response.status
        )
        this.isMemorizing = false
        return
      }

      const result = (await response.json()) as { task_id?: string }
      const taskId = result.task_id

      if (!taskId) {
        console.error('[Memorization] No task_id returned')
        this.isMemorizing = false
        return
      }

      console.log(`[Memorization] Task started: ${taskId}`)

      // Persist so we can recover if the process restarts.
      // Status will be checked lazily in checkActiveTask on the next
      // checkAndTrigger call (i.e. when a new message arrives or the
      // debounce timer fires).
      await memorizationStorage.setState({
        lastTaskId: taskId,
        messagesToRemoveOnSuccess: messageCount,
      })
    } catch (error) {
      console.error('[Memorization] Error in runMemorization:', error)
      this.isMemorizing = false
    }
  }

  private async monitorTask(
    taskId: string,
    messageCount: number
  ): Promise<void> {
    const startTime = Date.now()

    while (Date.now() - startTime < MEMORIZE_MAX_WAIT_MS) {
      const outcome = await this.resolveTaskStatus(taskId, messageCount)

      if (outcome === 'success') {
        console.log('[Memorization] Memorization succeeded')
        this.isMemorizing = false
        await this.checkAndTrigger()
        return
      }

      if (outcome === 'failure') {
        this.isMemorizing = false
        return
      }

      // 'pending' or 'error' — wait and retry
      await this.sleep(MEMORIZE_STATUS_POLL_INTERVAL_MS)
    }

    console.error(`[Memorization] Task ${taskId} timed out`)
    await memorizationStorage.clearTaskState()
    this.isMemorizing = false
  }

  // ==================== Recovery ====================

  private async recoverPendingTask(): Promise<void> {
    if (!(await this.isApiKeyConfigured())) return

    const state = await memorizationStorage.getState()
    if (!state.lastTaskId) return

    console.log(
      `[Memorization] Recovering pending task: ${state.lastTaskId} (${state.messagesToRemoveOnSuccess} messages)`
    )

    this.isMemorizing = true

    const outcome = await this.resolveTaskStatus(
      state.lastTaskId,
      state.messagesToRemoveOnSuccess
    )

    if (outcome === 'success' || outcome === 'failure') {
      this.isMemorizing = false
      return
    }

    if (outcome === 'error') {
      await memorizationStorage.clearTaskState()
      this.isMemorizing = false
      return
    }

    // 'pending' — leave isMemorizing true;
    // checkActiveTask will resolve it lazily on the next checkAndTrigger call
    console.log('[Memorization] Recovered task still pending, will check again lazily')
  }

  // ==================== Helpers ====================

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}

export const memorizationService = new MemorizationService()
