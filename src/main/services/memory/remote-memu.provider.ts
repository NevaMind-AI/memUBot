import { loadSettings } from '../../config/settings.config'
import type { StoredUnmemorizedMessage } from '../memorization.storage'
import type { MemoryProvider, MemoryProviderResult } from './memory-provider'

type MemorizeStatus = 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'FAILURE'

interface MemorizeStatusResponse {
  task_id: string
  status: MemorizeStatus
  detail_info: string
}

export class RemoteMemuProvider implements MemoryProvider {
  readonly kind = 'remote-memu'

  private async getMemuConfig() {
    const settings = await loadSettings()
    return {
      baseUrl: settings.memuBaseUrl,
      apiKey: settings.memuApiKey,
      userId: settings.memuUserId,
      agentId: settings.memuAgentId,
    }
  }

  async isConfigured(): Promise<boolean> {
    const settings = await loadSettings()
    return !!(
      settings.memuApiKey && settings.memuApiKey.trim() &&
      settings.memuBaseUrl && settings.memuBaseUrl.trim() &&
      settings.memuUserId && settings.memuUserId.trim() &&
      settings.memuAgentId && settings.memuAgentId.trim()
    )
  }

  async startMemorization(messages: StoredUnmemorizedMessage[]): Promise<{
    taskId: string | null
    messageCount: number
  }> {
    const memuConfig = await this.getMemuConfig()
    const formattedMessages = messages.map((m) => ({
      role: m.role,
      content: `[${m.platform}] ${m.content}`,
    }))

    console.log(`[Memorization] Sending ${formattedMessages.length} messages to memorize`)

    const response = await fetch(`${memuConfig.baseUrl}/api/v3/memory/memorize`, {
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
    })

    if (!response.ok) {
      console.error('[Memorization] API returned status:', response.status)
      return {
        taskId: null,
        messageCount: messages.length,
      }
    }

    const result = (await response.json()) as { task_id?: string }
    const taskId = result.task_id

    if (!taskId) {
      console.error('[Memorization] No task_id returned')
      return {
        taskId: null,
        messageCount: messages.length,
      }
    }

    console.log(`[Memorization] Task started: ${taskId}`)

    return {
      taskId,
      messageCount: messages.length,
    }
  }

  async checkTaskStatus(taskId: string, messageCount: number): Promise<MemoryProviderResult> {
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
        return { status: 'error' }
      }

      const result = (await response.json()) as MemorizeStatusResponse
      console.log(`[Memorization] Task ${taskId} status: ${result.status}`)

      if (result.status === 'SUCCESS') {
        return { status: 'success' }
      }

      if (result.status === 'FAILURE') {
        console.error(`[Memorization] Task ${taskId} failed: ${result.detail_info}`)
        return { status: 'failure' }
      }

      return { status: 'pending' }
    } catch (error) {
      console.error(`[Memorization] Error checking task ${taskId}:`, error)
      return { status: 'error' }
    }
  }
}
