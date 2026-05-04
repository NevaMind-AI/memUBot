import { ipcMain } from 'electron'
import type { IpcResponse } from '../types'
import { localMemoryControlService, type DoNotRememberInput } from '../services/local-memory-control.service'
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
  MemoryStatus,
  MemoryUserControl,
  MemoryConflictState,
} from '../services/memory/local-memory.store'

const MEMORY_SENSITIVITY_LEVELS: readonly MemorySensitivityLevel[] = ['normal', 'work', 'sensitive']
const MEMORY_STATUSES: readonly MemoryStatus[] = ['active', 'archived', 'deleted']
const MEMORY_USER_CONTROLS: readonly MemoryUserControl[] = ['auto', 'remember', 'dont_remember', 'modified', 'deleted', 'paused']
const MEMORY_CONFLICT_STATES: readonly MemoryConflictState[] = ['none', 'potential', 'confirmed']

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function assertNonEmptyString(value: unknown, fieldName: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${fieldName} must be a non-empty string`)
  }
  return value.trim()
}

function optionalNullableString(value: unknown, fieldName: string): string | null | undefined {
  if (value === undefined) return undefined
  if (value === null) return null
  if (typeof value !== 'string') {
    throw new Error(`${fieldName} must be a string or null`)
  }
  return value
}

function optionalNumber(value: unknown, fieldName: string): number | undefined {
  if (value === undefined) return undefined
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${fieldName} must be a finite number`)
  }
  return value
}

function optionalEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fieldName: string
): T | undefined {
  if (value === undefined) return undefined
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    throw new Error(`${fieldName} must be one of: ${allowed.join(', ')}`)
  }
  return value as T
}

function sanitizeCreateMemoryInput(input: unknown): CreateLocalMemoryInput {
  if (!isRecord(input)) throw new Error('memory input must be an object')

  return {
    id: optionalNullableString(input.id, 'id') ?? undefined,
    content: assertNonEmptyString(input.content, 'content'),
    memory_type: assertNonEmptyString(input.memory_type, 'memory_type'),
    source_platform: optionalNullableString(input.source_platform, 'source_platform'),
    source_excerpt: optionalNullableString(input.source_excerpt, 'source_excerpt'),
    confidence: optionalNumber(input.confidence, 'confidence'),
    importance: optionalNumber(input.importance, 'importance'),
    sensitivity_level: optionalEnum(input.sensitivity_level, MEMORY_SENSITIVITY_LEVELS, 'sensitivity_level'),
    retention_until: input.retention_until === null ? null : optionalNumber(input.retention_until, 'retention_until'),
    status: optionalEnum(input.status, MEMORY_STATUSES, 'status'),
    user_control: optionalEnum(input.user_control, MEMORY_USER_CONTROLS, 'user_control'),
    why_stored: optionalNullableString(input.why_stored, 'why_stored'),
    conflict_state: optionalEnum(input.conflict_state, MEMORY_CONFLICT_STATES, 'conflict_state'),
    conflict_notes: optionalNullableString(input.conflict_notes, 'conflict_notes'),
  }
}

function sanitizeDoNotRememberInput(input: unknown): DoNotRememberInput {
  if (!isRecord(input)) throw new Error('do-not-remember input must be an object')

  return {
    content: assertNonEmptyString(input.content, 'content'),
    memory_type: typeof input.memory_type === 'string' ? input.memory_type : undefined,
    source_platform: optionalNullableString(input.source_platform, 'source_platform'),
    source_excerpt: optionalNullableString(input.source_excerpt, 'source_excerpt'),
    sensitivity_level: optionalEnum(input.sensitivity_level, MEMORY_SENSITIVITY_LEVELS, 'sensitivity_level'),
    reason: optionalNullableString(input.reason, 'reason'),
  }
}

function sanitizeUpdateMemoryInput(input: unknown): UpdateLocalMemoryInput {
  if (!isRecord(input)) throw new Error('memory update input must be an object')

  return {
    content: typeof input.content === 'string' ? input.content : undefined,
    memory_type: typeof input.memory_type === 'string' ? input.memory_type : undefined,
    source_platform: optionalNullableString(input.source_platform, 'source_platform'),
    source_excerpt: optionalNullableString(input.source_excerpt, 'source_excerpt'),
    confidence: optionalNumber(input.confidence, 'confidence'),
    importance: optionalNumber(input.importance, 'importance'),
    sensitivity_level: optionalEnum(input.sensitivity_level, MEMORY_SENSITIVITY_LEVELS, 'sensitivity_level'),
    retention_until: input.retention_until === null ? null : optionalNumber(input.retention_until, 'retention_until'),
    status: optionalEnum(input.status, MEMORY_STATUSES, 'status'),
    user_control: optionalEnum(input.user_control, MEMORY_USER_CONTROLS, 'user_control'),
    why_stored: optionalNullableString(input.why_stored, 'why_stored'),
    conflict_state: optionalEnum(input.conflict_state, MEMORY_CONFLICT_STATES, 'conflict_state'),
    conflict_notes: optionalNullableString(input.conflict_notes, 'conflict_notes'),
  }
}

function sanitizeSearchFilters(input: unknown): MemorySearchFilters {
  if (input === undefined) return {}
  if (!isRecord(input)) throw new Error('memory search filters must be an object')

  return {
    query: typeof input.query === 'string' ? input.query : undefined,
    limit: optionalNumber(input.limit, 'limit'),
    include_archived: typeof input.include_archived === 'boolean' ? input.include_archived : undefined,
    created_after: optionalNumber(input.created_after, 'created_after'),
    created_before: optionalNumber(input.created_before, 'created_before'),
    updated_after: optionalNumber(input.updated_after, 'updated_after'),
    updated_before: optionalNumber(input.updated_before, 'updated_before'),
    min_confidence: optionalNumber(input.min_confidence, 'min_confidence'),
    min_importance: optionalNumber(input.min_importance, 'min_importance'),
    exclude_sensitive: typeof input.exclude_sensitive === 'boolean' ? input.exclude_sensitive : undefined,
    status: optionalEnum(input.status, MEMORY_STATUSES, 'status'),
    memory_type: typeof input.memory_type === 'string' ? input.memory_type : undefined,
    source_platform: typeof input.source_platform === 'string' ? input.source_platform : undefined,
    sensitivity_level: optionalEnum(input.sensitivity_level, MEMORY_SENSITIVITY_LEVELS, 'sensitivity_level'),
    user_control: optionalEnum(input.user_control, MEMORY_USER_CONTROLS, 'user_control'),
    conflict_state: optionalEnum(input.conflict_state, MEMORY_CONFLICT_STATES, 'conflict_state'),
  }
}

function sanitizeListFilters(input: unknown): LocalMemoryListFilters {
  if (input === undefined) return {}
  if (!isRecord(input)) throw new Error('memory list filters must be an object')

  return {
    status: optionalEnum(input.status, MEMORY_STATUSES, 'status'),
    memory_type: typeof input.memory_type === 'string' ? input.memory_type : undefined,
    source_platform: typeof input.source_platform === 'string' ? input.source_platform : undefined,
    sensitivity_level: optionalEnum(input.sensitivity_level, MEMORY_SENSITIVITY_LEVELS, 'sensitivity_level'),
    user_control: optionalEnum(input.user_control, MEMORY_USER_CONTROLS, 'user_control'),
    created_after: optionalNumber(input.created_after, 'created_after'),
    created_before: optionalNumber(input.created_before, 'created_before'),
    updated_after: optionalNumber(input.updated_after, 'updated_after'),
    updated_before: optionalNumber(input.updated_before, 'updated_before'),
    min_confidence: optionalNumber(input.min_confidence, 'min_confidence'),
    min_importance: optionalNumber(input.min_importance, 'min_importance'),
    conflict_state: optionalEnum(input.conflict_state, MEMORY_CONFLICT_STATES, 'conflict_state'),
  }
}

export function setupMemoryHandlers(): void {
  ipcMain.handle('memory:get-status', async (): Promise<IpcResponse<{ paused: boolean }>> => {
    try {
      const status = await localMemoryControlService.getCaptureStatus()
      return { success: true, data: status }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  })

  ipcMain.handle(
    'memory:remember-this',
    async (_event, input: CreateLocalMemoryInput): Promise<IpcResponse<LocalMemoryItem>> => {
      try {
        const memory = await localMemoryControlService.rememberThis(sanitizeCreateMemoryInput(input))
        return { success: true, data: memory }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : String(error) }
      }
    }
  )

  ipcMain.handle(
    'memory:do-not-remember-this',
    async (_event, input: DoNotRememberInput): Promise<IpcResponse<LocalMemoryItem>> => {
      try {
        const memory = await localMemoryControlService.doNotRememberThis(sanitizeDoNotRememberInput(input))
        return { success: true, data: memory }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : String(error) }
      }
    }
  )

  ipcMain.handle('memory:get', async (_event, id: string): Promise<IpcResponse<LocalMemoryItem | null>> => {
    try {
      const memory = await localMemoryControlService.getMemoryById(assertNonEmptyString(id, 'id'))
      return { success: true, data: memory }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  })


  ipcMain.handle(
    'memory:get-explained',
    async (_event, id: string): Promise<IpcResponse<ExplainedLocalMemoryItem | null>> => {
      try {
        const memory = await localMemoryControlService.getExplainedMemoryById(assertNonEmptyString(id, 'id'))
        return { success: true, data: memory }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : String(error) }
      }
    }
  )

  ipcMain.handle(
    'memory:get-provenance',
    async (_event, id: string): Promise<IpcResponse<MemoryProvenance | null>> => {
      try {
        const provenance = await localMemoryControlService.getMemoryProvenance(assertNonEmptyString(id, 'id'))
        return { success: true, data: provenance }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : String(error) }
      }
    }
  )

  ipcMain.handle(
    'memory:list',
    async (_event, filters?: LocalMemoryListFilters): Promise<IpcResponse<LocalMemoryItem[]>> => {
      try {
        const memories = await localMemoryControlService.listMemories(sanitizeListFilters(filters))
        return { success: true, data: memories }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : String(error) }
      }
    }
  )


  ipcMain.handle(
    'memory:list-explained',
    async (_event, filters?: LocalMemoryListFilters): Promise<IpcResponse<ExplainedLocalMemoryItem[]>> => {
      try {
        const memories = await localMemoryControlService.listExplainedMemories(sanitizeListFilters(filters))
        return { success: true, data: memories }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : String(error) }
      }
    }
  )

  ipcMain.handle(
    'memory:search',
    async (_event, filters?: MemorySearchFilters): Promise<IpcResponse<MemoryRetrievalResult[]>> => {
      try {
        const results = await localMemoryControlService.searchMemories(sanitizeSearchFilters(filters))
        return { success: true, data: results }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : String(error) }
      }
    }
  )

  ipcMain.handle(
    'memory:update',
    async (
      _event,
      id: string,
      updates: UpdateLocalMemoryInput
    ): Promise<IpcResponse<LocalMemoryItem | null>> => {
      try {
        const memory = await localMemoryControlService.updateMemory(assertNonEmptyString(id, 'id'), sanitizeUpdateMemoryInput(updates))
        return { success: true, data: memory }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : String(error) }
      }
    }
  )

  ipcMain.handle('memory:delete', async (_event, id: string): Promise<IpcResponse<{ deleted: boolean }>> => {
    try {
      const deleted = await localMemoryControlService.deleteMemory(assertNonEmptyString(id, 'id'))
      return { success: true, data: { deleted } }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  })


  ipcMain.handle(
    'memory:delete-by-source',
    async (_event, sourcePlatform: string): Promise<IpcResponse<{ deletedCount: number }>> => {
      try {
        const deletedCount = await localMemoryControlService.deleteMemoriesBySource(assertNonEmptyString(sourcePlatform, 'sourcePlatform'))
        return { success: true, data: { deletedCount } }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : String(error) }
      }
    }
  )

  ipcMain.handle(
    'memory:list-events',
    async (_event, memoryId: string): Promise<IpcResponse<MemoryEventRecord[]>> => {
      try {
        const events = await localMemoryControlService.listMemoryEvents(assertNonEmptyString(memoryId, 'memoryId'))
        return { success: true, data: events }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : String(error) }
      }
    }
  )

  ipcMain.handle(
    'memory:pause-capture',
    async (_event, reason?: string): Promise<IpcResponse<{ paused: boolean }>> => {
      try {
        const status = await localMemoryControlService.pauseCapture(reason)
        return { success: true, data: status }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : String(error) }
      }
    }
  )

  ipcMain.handle(
    'memory:resume-capture',
    async (_event, reason?: string): Promise<IpcResponse<{ paused: boolean }>> => {
      try {
        const status = await localMemoryControlService.resumeCapture(reason)
        return { success: true, data: status }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : String(error) }
      }
    }
  )

  console.log('[Memory IPC] Handlers registered')
}
