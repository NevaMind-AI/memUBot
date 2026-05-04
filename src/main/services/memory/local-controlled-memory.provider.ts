import * as fs from 'fs/promises'
import * as path from 'path'
import { app } from 'electron'
import type { StoredUnmemorizedMessage } from '../memorization.storage'
import {
  localMemoryStore,
  type CreateLocalMemoryInput,
  type ExplainedLocalMemoryItem,
  type LocalMemoryItem,
  type LocalMemoryListFilters,
  type MemoryEventRecord,
  type MemoryProvenance,
  type MemoryRetrievalResult,
  type MemorySearchFilters,
  type UpdateLocalMemoryInput,
} from './local-memory.store'
import type { MemoryProvider, MemoryProviderResult } from './memory-provider'

const STORAGE_DIR = 'memorization-data'
const PROVIDER_STATE_FILE = 'local-memory-provider-state.json'

interface LocalMemoryProviderState {
  capturePaused: boolean
  updatedAt: number
  reason?: string | null
}

const DEFAULT_PROVIDER_STATE: LocalMemoryProviderState = {
  capturePaused: false,
  updatedAt: 0,
  reason: null,
}

export class LocalControlledMemoryProvider implements MemoryProvider {
  readonly kind = 'local-controlled-memory'
  private statePath = path.join(app.getPath('userData'), STORAGE_DIR, PROVIDER_STATE_FILE)
  private state: LocalMemoryProviderState = { ...DEFAULT_PROVIDER_STATE }
  private stateLoaded = false

  async isConfigured(): Promise<boolean> {
    await localMemoryStore.initialize()
    await this.ensureStateLoaded()
    return true
  }

  async startMemorization(messages: StoredUnmemorizedMessage[]): Promise<{
    taskId: string | null
    messageCount: number
  }> {
    await localMemoryStore.initialize()
    await this.ensureStateLoaded()

    if (this.state.capturePaused) {
      return {
        taskId: null,
        messageCount: 0,
      }
    }

    let storedCount = 0

    for (const message of messages) {
      if (await localMemoryStore.hasSuppressedMatch(message.content, message.platform)) {
        continue
      }

      const inferredSensitivity = this.inferAutomaticSensitivity(message.content, message.platform)
      if (inferredSensitivity === 'sensitive') {
        continue
      }

      const existing = await localMemoryStore.searchMemories({
        query: message.content,
        limit: 1,
        source_platform: message.platform,
        memory_type: 'conversation_message',
        include_archived: true,
        exclude_sensitive: false,
      })

      const best = existing[0]
      const looksDuplicated = best && best.memory.content === message.content && best.retrieval_explanation.score >= 4.5
      if (looksDuplicated) {
        continue
      }

      await this.createMemory({
        content: message.content,
        memory_type: 'conversation_message',
        source_platform: message.platform,
        source_excerpt: message.content.slice(0, 240),
        confidence: inferredSensitivity === 'work' ? 0.6 : 0.5,
        importance: inferredSensitivity === 'work' ? 0.65 : 0.5,
        sensitivity_level: inferredSensitivity,
        status: 'active',
        user_control: 'auto',
        why_stored: 'Captured from message stream by LocalControlledMemoryProvider',
      })
      storedCount += 1
    }

    return {
      taskId: null,
      messageCount: storedCount,
    }
  }


  private inferAutomaticSensitivity(content: string, sourcePlatform?: string | null): 'normal' | 'work' | 'sensitive' {
    const text = `${sourcePlatform ?? ''} ${content}`.toLowerCase()
    if (/password|passcode|otp|verification code|ssn|social security|bank account|credit card|api key|secret|token|passport|diagnosis|medical/.test(text)) {
      return 'sensitive'
    }
    if (/slack|meeting|project|roadmap|deadline|client|customer|jira|notion|github|repo|work/.test(text)) {
      return 'work'
    }
    return 'normal'
  }

  async checkTaskStatus(_taskId: string, _messageCount: number): Promise<MemoryProviderResult> {
    return { status: 'success' }
  }

  async createMemory(input: CreateLocalMemoryInput): Promise<LocalMemoryItem> {
    await localMemoryStore.initialize()
    return localMemoryStore.createMemory(input)
  }

  async getMemoryById(id: string): Promise<LocalMemoryItem | null> {
    await localMemoryStore.initialize()
    return localMemoryStore.getMemoryById(id)
  }


  async getExplainedMemoryById(id: string): Promise<ExplainedLocalMemoryItem | null> {
    await localMemoryStore.initialize()
    return localMemoryStore.getExplainedMemoryById(id)
  }

  async getMemoryProvenance(id: string): Promise<MemoryProvenance | null> {
    await localMemoryStore.initialize()
    return localMemoryStore.getProvenanceById(id)
  }

  async searchMemories(filters: MemorySearchFilters = {}): Promise<MemoryRetrievalResult[]> {
    await localMemoryStore.initialize()
    return localMemoryStore.searchMemories(filters)
  }

  async listExplainedMemories(filters: LocalMemoryListFilters = {}): Promise<ExplainedLocalMemoryItem[]> {
    await localMemoryStore.initialize()
    return localMemoryStore.listExplainedMemories(filters)
  }

  async listMemories(filters: LocalMemoryListFilters = {}): Promise<LocalMemoryItem[]> {
    await localMemoryStore.initialize()
    return localMemoryStore.listMemories(filters)
  }

  async updateMemory(id: string, updates: UpdateLocalMemoryInput): Promise<LocalMemoryItem | null> {
    await localMemoryStore.initialize()
    return localMemoryStore.updateMemory(id, updates)
  }

  async deleteMemory(id: string): Promise<boolean> {
    await localMemoryStore.initialize()
    return localMemoryStore.deleteMemory(id)
  }

  async deleteMemoriesBySource(sourcePlatform: string): Promise<number> {
    await localMemoryStore.initialize()
    return localMemoryStore.deleteMemoriesBySource(sourcePlatform)
  }

  async listMemoryEvents(memoryId: string): Promise<MemoryEventRecord[]> {
    await localMemoryStore.initialize()
    return localMemoryStore.listEvents(memoryId)
  }

  async getCaptureStatus(): Promise<{ paused: boolean }> {
    await this.ensureStateLoaded()
    return { paused: this.state.capturePaused }
  }

  async pauseCapture(reason?: string): Promise<{ paused: boolean }> {
    await this.ensureStateLoaded()
    if (!this.state.capturePaused) {
      this.state = {
        capturePaused: true,
        updatedAt: Date.now(),
        reason: reason ?? null,
      }
      await this.saveState()
    }
    return { paused: true }
  }

  async resumeCapture(reason?: string): Promise<{ paused: boolean }> {
    await this.ensureStateLoaded()
    if (this.state.capturePaused) {
      this.state = {
        capturePaused: false,
        updatedAt: Date.now(),
        reason: reason ?? null,
      }
      await this.saveState()
    }
    return { paused: false }
  }

  private async ensureStateLoaded(): Promise<void> {
    if (this.stateLoaded) return

    try {
      await fs.mkdir(path.dirname(this.statePath), { recursive: true })
      const raw = await fs.readFile(this.statePath, 'utf-8')
      const parsed = JSON.parse(raw) as Partial<LocalMemoryProviderState>
      this.state = {
        capturePaused: parsed.capturePaused ?? DEFAULT_PROVIDER_STATE.capturePaused,
        updatedAt: parsed.updatedAt ?? DEFAULT_PROVIDER_STATE.updatedAt,
        reason: parsed.reason ?? DEFAULT_PROVIDER_STATE.reason,
      }
    } catch {
      this.state = { ...DEFAULT_PROVIDER_STATE }
      await this.saveState()
    }

    this.stateLoaded = true
  }

  private async saveState(): Promise<void> {
    await fs.mkdir(path.dirname(this.statePath), { recursive: true })
    await fs.writeFile(this.statePath, JSON.stringify(this.state, null, 2), 'utf-8')
  }
}
