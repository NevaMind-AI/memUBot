import type Anthropic from '@anthropic-ai/sdk'
import { estimateTokens } from '../token-estimator'
import { LayeredContextIndexer } from './indexer'
import { LayeredContextMetrics } from './metrics'
import { LayeredContextRetriever } from './retriever'
import type { LayeredIndexBuildInput } from './indexer'
import type { LayeredIndexBuildResult } from './types'
import type {
  LayeredContextApplicationResult,
  LayeredContextConfig,
  LayeredRetrievalResult
} from './types'
import type { LayeredContextStorage } from './storage'

export interface ApplyLayeredContextInput {
  sessionKey: string
  platform: string
  chatId: string | null
  query: string
  messages: Anthropic.MessageParam[]
  config: LayeredContextConfig
}

function buildLayeredPromptBlock(retrieval: LayeredRetrievalResult): string {
  const lines: string[] = []
  lines.push('Layered context package (L0/L1/L2) generated from archived history.')
  lines.push(`Escalation decision: ${retrieval.decision.reachedLayer} (${retrieval.decision.reason})`)
  lines.push('')

  const layers: Array<'L0' | 'L1' | 'L2'> = ['L0', 'L1', 'L2']
  for (const layer of layers) {
    const layerItems = retrieval.selections.filter((item) => item.layer === layer)
    if (layerItems.length === 0) continue
    lines.push(`${layer} context:`)
    for (const item of layerItems) {
      lines.push(`- node=${item.nodeId}, score=${item.score.toFixed(3)}, tokens=${item.estimatedTokens}`)
      lines.push(item.content)
    }
    lines.push('')
  }

  lines.push(
    `Layer token usage: L0=${retrieval.tokenUsage.l0}, L1=${retrieval.tokenUsage.l1}, L2=${retrieval.tokenUsage.l2}, total=${retrieval.tokenUsage.total}`
  )
  lines.push(
    `Baseline L2=${retrieval.tokenUsage.baselineL2}, savings=${retrieval.tokenUsage.savings} (${(retrieval.tokenUsage.savingsRatio * 100).toFixed(1)}%)`
  )

  return lines.join('\n')
}

export class LayeredContextManager {
  private readonly metrics = new LayeredContextMetrics()
  private readonly updateChains = new Map<string, Promise<void>>()

  constructor(
    private readonly storage: LayeredContextStorage,
    private readonly indexer: LayeredContextIndexer,
    private readonly retriever: LayeredContextRetriever
  ) {}

  getMetricsSnapshot() {
    return this.metrics.snapshot()
  }

  private enqueueIndexBuild(input: LayeredIndexBuildInput): Promise<LayeredIndexBuildResult> {
    const previous = this.updateChains.get(input.sessionKey) ?? Promise.resolve()

    const task = previous
      .catch(() => {
        // Keep queue chain alive after failures.
      })
      .then(async (): Promise<LayeredIndexBuildResult> => {
        const result = await this.indexer.buildIndex(input)
        if (result.fallbackEvents.length > 0) {
          this.metrics.recordFallback(result.fallbackEvents.length)
        }
        return result
      })

    this.updateChains.set(
      input.sessionKey,
      task.then(
        () => undefined,
        () => undefined
      )
    )

    return task
  }

  async apply(input: ApplyLayeredContextInput): Promise<LayeredContextApplicationResult> {
    if (!input.config.enableSessionCompression || input.messages.length <= input.config.maxRecentMessages + 1) {
      return {
        applied: false,
        updatedMessages: input.messages,
        retrieval: null,
        fallbackEvents: [],
        archivedMessageCount: 0
      }
    }

    const currentMessage = input.messages[input.messages.length - 1]
    const historical = input.messages.slice(0, -1)
    if (historical.length <= input.config.maxRecentMessages) {
      return {
        applied: false,
        updatedMessages: input.messages,
        retrieval: null,
        fallbackEvents: [],
        archivedMessageCount: 0
      }
    }

    const archivedMessages = historical.slice(0, -input.config.maxRecentMessages)
    const recentMessages = historical.slice(-input.config.maxRecentMessages)
    const buildInput: LayeredIndexBuildInput = {
      sessionKey: input.sessionKey,
      platform: input.platform,
      chatId: input.chatId,
      archivedMessages,
      config: input.config
    }

    const fallbackEvents: string[] = []
    let index = await this.storage.loadIndex(input.sessionKey)
    const backgroundBuild = this.enqueueIndexBuild(buildInput)
    if (!index || index.nodes.length === 0) {
      const buildResult = await backgroundBuild
      index = buildResult.index
      fallbackEvents.push(...buildResult.fallbackEvents)
    } else {
      backgroundBuild
        .then((buildResult) => {
          if (buildResult.fallbackEvents.length > 0) {
            console.warn(
              `[LayeredContext] Summary fallback events in background indexing: ${buildResult.fallbackEvents.join(', ')}`
            )
          }
        })
        .catch((error) => {
          console.warn('[LayeredContext] Background indexing failed:', error)
        })
    }

    if (!index || index.nodes.length === 0) {
      return {
        applied: false,
        updatedMessages: input.messages,
        retrieval: null,
        fallbackEvents,
        archivedMessageCount: archivedMessages.length
      }
    }

    const retrieval = await this.retriever.retrieve(index, input.query, input.config)
    this.metrics.recordRetrieval(retrieval)

    const layeredBlock = buildLayeredPromptBlock(retrieval)
    const syntheticRole = recentMessages[0]?.role === 'assistant' ? 'user' : 'assistant'

    const updatedMessages: Anthropic.MessageParam[] = [
      { role: syntheticRole, content: layeredBlock },
      ...recentMessages,
      currentMessage
    ]

    // Always respect budget cap by trimming oldest recent messages first.
    while (
      updatedMessages.length > 2 &&
      updatedMessages.reduce((sum, message) => sum + estimateTokens(message), 0) > input.config.maxPromptTokens
    ) {
      updatedMessages.splice(1, 1)
    }

    return {
      applied: true,
      updatedMessages,
      retrieval,
      fallbackEvents,
      archivedMessageCount: archivedMessages.length
    }
  }
}
