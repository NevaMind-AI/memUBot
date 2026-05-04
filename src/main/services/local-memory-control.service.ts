import { LocalControlledMemoryProvider } from './memory/local-controlled-memory.provider'
import { memorizationStorage } from './memorization.storage'
import type {
  CreateLocalMemoryInput,
  ExplainedLocalMemoryItem,
  LocalMemoryItem,
  LocalMemoryListFilters,
  MemoryEventRecord,
  MemoryProvenance,
  MemoryRetrievalResult,
  MemorySearchFilters,
  UpdateLocalMemoryInput,
  MemorySensitivityLevel,
} from './memory/local-memory.store'

export interface DoNotRememberInput {
  content: string
  memory_type?: string
  source_platform?: string | null
  source_excerpt?: string | null
  sensitivity_level?: MemorySensitivityLevel
  reason?: string | null
}

class LocalMemoryControlService {
  private readonly provider = new LocalControlledMemoryProvider()

  async initialize(): Promise<void> {
    await this.provider.isConfigured()
  }

  async getCaptureStatus(): Promise<{ paused: boolean }> {
    await this.initialize()
    return this.provider.getCaptureStatus()
  }

  async rememberThis(input: CreateLocalMemoryInput): Promise<LocalMemoryItem> {
    await this.initialize()
    return this.provider.createMemory({
      ...input,
      status: input.status ?? 'active',
      user_control: 'remember',
      why_stored: input.why_stored ?? 'User explicitly chose to remember this',
    })
  }

  async doNotRememberThis(input: DoNotRememberInput): Promise<LocalMemoryItem> {
    await this.initialize()

    const existingMatches = await this.provider.searchMemories({
      query: input.content,
      limit: 10,
      include_archived: true,
      source_platform: input.source_platform ?? undefined,
      exclude_sensitive: false,
    })

    let existingSuppressionRule: LocalMemoryItem | null = null

    for (const match of existingMatches) {
      if (match.memory.content !== input.content) {
        continue
      }

      if (match.memory.user_control === 'dont_remember') {
        existingSuppressionRule = match.memory
        continue
      }

      await this.provider.updateMemory(match.memory.id, {
        status: 'archived',
        user_control: 'dont_remember',
        why_stored: input.reason ?? 'Archived because the user explicitly chose not to remember this',
      })
    }

    if (existingSuppressionRule) {
      return (
        (await this.provider.updateMemory(existingSuppressionRule.id, {
          memory_type: input.memory_type ?? existingSuppressionRule.memory_type ?? 'suppression_rule',
          source_platform: input.source_platform ?? existingSuppressionRule.source_platform ?? null,
          source_excerpt: input.source_excerpt ?? input.content.slice(0, 240),
          sensitivity_level: input.sensitivity_level ?? existingSuppressionRule.sensitivity_level ?? 'normal',
          status: 'archived',
          user_control: 'dont_remember',
          why_stored: input.reason ?? 'User explicitly chose not to remember this',
          retention_until: null,
          confidence: 1,
          importance: 0,
        })) ?? existingSuppressionRule
      )
    }

    return this.provider.createMemory({
      content: input.content,
      memory_type: input.memory_type ?? 'suppression_rule',
      source_platform: input.source_platform ?? null,
      source_excerpt: input.source_excerpt ?? input.content.slice(0, 240),
      confidence: 1,
      importance: 0,
      sensitivity_level: input.sensitivity_level ?? 'normal',
      retention_until: null,
      status: 'archived',
      user_control: 'dont_remember',
      why_stored: input.reason ?? 'User explicitly chose not to remember this',
    })
  }

  async getMemoryById(id: string): Promise<LocalMemoryItem | null> {
    await this.initialize()
    return this.provider.getMemoryById(id)
  }


  async getExplainedMemoryById(id: string): Promise<ExplainedLocalMemoryItem | null> {
    await this.initialize()
    return this.provider.getExplainedMemoryById(id)
  }

  async getMemoryProvenance(id: string): Promise<MemoryProvenance | null> {
    await this.initialize()
    return this.provider.getMemoryProvenance(id)
  }

  async searchMemories(filters: MemorySearchFilters = {}): Promise<MemoryRetrievalResult[]> {
    await this.initialize()
    return this.provider.searchMemories(filters)
  }

  async listExplainedMemories(filters: LocalMemoryListFilters = {}): Promise<ExplainedLocalMemoryItem[]> {
    await this.initialize()
    return this.provider.listExplainedMemories(filters)
  }

  async listMemories(filters: LocalMemoryListFilters = {}): Promise<LocalMemoryItem[]> {
    await this.initialize()
    return this.provider.listMemories(filters)
  }

  async updateMemory(id: string, updates: UpdateLocalMemoryInput): Promise<LocalMemoryItem | null> {
    await this.initialize()
    return this.provider.updateMemory(id, {
      ...updates,
      user_control: updates.user_control ?? 'modified',
    })
  }

  async deleteMemory(id: string): Promise<boolean> {
    await this.initialize()
    return this.provider.deleteMemory(id)
  }

  async deleteMemoriesBySource(sourcePlatform: string): Promise<number> {
    await this.initialize()
    return this.provider.deleteMemoriesBySource(sourcePlatform)
  }

  async listMemoryEvents(memoryId: string): Promise<MemoryEventRecord[]> {
    await this.initialize()
    return this.provider.listMemoryEvents(memoryId)
  }

  async pauseCapture(reason?: string): Promise<{ paused: boolean }> {
    await this.initialize()
    const result = await this.provider.pauseCapture(reason)
    await memorizationStorage.initialize()
    await memorizationStorage.clearMessages()
    await memorizationStorage.clearTaskState()
    await memorizationStorage.updateFirstMessageTimestamp()
    return result
  }

  async resumeCapture(reason?: string): Promise<{ paused: boolean }> {
    await this.initialize()
    return this.provider.resumeCapture(reason)
  }
}

export const localMemoryControlService = new LocalMemoryControlService()
