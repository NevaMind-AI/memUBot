import type { StoredUnmemorizedMessage } from '../memorization.storage'

export type MemoryProviderResult =
  | { status: 'success' }
  | { status: 'failure' }
  | { status: 'pending' }
  | { status: 'error' }

export interface MemoryProvider {
  readonly kind: string

  isConfigured(): Promise<boolean>

  startMemorization(messages: StoredUnmemorizedMessage[]): Promise<{
    taskId: string | null
    messageCount: number
  }>

  checkTaskStatus(taskId: string, messageCount: number): Promise<MemoryProviderResult>
}
