import { createHash } from 'crypto'
import { estimateTextTokens } from '../token-estimator'
import { splitArchiveMessages, toTranscript } from './message-utils'
import { LayeredSummaryGenerator } from './summarizer'
import type { LayeredContextConfig, LayeredContextIndexDocument, LayeredIndexBuildResult } from './types'
import { extractTopKeywords } from './text-utils'
import type { LayeredContextStorage } from './storage'
import type Anthropic from '@anthropic-ai/sdk'

export interface LayeredIndexBuildInput {
  sessionKey: string
  platform: string
  chatId: string | null
  archivedMessages: Anthropic.MessageParam[]
  config: LayeredContextConfig
}

function checksumOfText(input: string): string {
  return createHash('sha1').update(input).digest('hex')
}

export class LayeredContextIndexer {
  constructor(
    private readonly storage: LayeredContextStorage,
    private readonly summaryGenerator: LayeredSummaryGenerator
  ) {}

  async buildIndex(input: LayeredIndexBuildInput): Promise<LayeredIndexBuildResult> {
    const now = Date.now()
    const existing = await this.storage.loadIndex(input.sessionKey)

    const maxMessages = input.config.maxArchives * input.config.archiveChunkSize
    const boundedMessages =
      input.archivedMessages.length > maxMessages
        ? input.archivedMessages.slice(-maxMessages)
        : input.archivedMessages

    const chunks = splitArchiveMessages(boundedMessages, input.config.archiveChunkSize)
    const existingByChecksum = new Map((existing?.nodes ?? []).map((node) => [node.checksum, node]))
    const fallbackEvents: string[] = []

    const nextNodes: LayeredContextIndexDocument['nodes'] = []
    let cursor = 0
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]
      const startMessageIndex = cursor
      const endMessageIndex = cursor + chunk.length - 1
      cursor += chunk.length

      const transcript = toTranscript(chunk)
      if (!transcript) continue

      const checksum = checksumOfText(transcript)
      const cached = existingByChecksum.get(checksum)
      if (cached) {
        nextNodes.push({
          ...cached,
          metadata: {
            ...cached.metadata,
            platform: input.platform,
            chatId: input.chatId,
            startMessageIndex,
            endMessageIndex,
            messageCount: chunk.length
          },
          updatedAt: now
        })
        continue
      }

      const summary = await this.summaryGenerator.generateSummary(transcript, input.config.l1TargetTokens)
      const abstract = await this.summaryGenerator.generateAbstract(summary.text, input.config.l0TargetTokens)

      if (summary.fallbackUsed && summary.fallbackReason) {
        fallbackEvents.push(summary.fallbackReason)
      }
      if (abstract.fallbackUsed && abstract.fallbackReason) {
        fallbackEvents.push(abstract.fallbackReason)
      }

      const nodeId = `archive_${checksum.slice(0, 14)}`
      const resourcePath = await this.storage.writeArchive(input.sessionKey, nodeId, {
        sessionKey: input.sessionKey,
        nodeId,
        transcript,
        messages: chunk,
        createdAt: now
      })

      nextNodes.push({
        id: nodeId,
        parentId: 'root',
        abstract: abstract.text,
        summary: summary.text,
        resourcePath,
        keywords: extractTopKeywords(`${abstract.text}\n${summary.text}`),
        checksum,
        metadata: {
          platform: input.platform,
          chatId: input.chatId,
          startMessageIndex,
          endMessageIndex,
          messageCount: chunk.length,
          recencyRank: 0
        },
        tokenEstimate: {
          l0: estimateTextTokens(abstract.text),
          l1: estimateTextTokens(summary.text),
          l2: estimateTextTokens(transcript)
        },
        createdAt: now,
        updatedAt: now
      })
    }

    const sortedByRecency = [...nextNodes].sort((a, b) => b.metadata.endMessageIndex - a.metadata.endMessageIndex)
    const kept = sortedByRecency.slice(0, input.config.maxArchives).map((node, index) => ({
      ...node,
      metadata: {
        ...node.metadata,
        recencyRank: index + 1
      }
    }))

    const rootSummarySource = kept
      .map((node) => `Archive ${node.id}\n${node.summary}`)
      .join('\n\n')

    const rootSummary = await this.summaryGenerator.generateSummary(
      rootSummarySource || 'No archived context is available.',
      input.config.l1TargetTokens
    )
    const rootAbstract = await this.summaryGenerator.generateAbstract(rootSummary.text, input.config.l0TargetTokens)

    if (rootSummary.fallbackUsed && rootSummary.fallbackReason) {
      fallbackEvents.push(rootSummary.fallbackReason)
    }
    if (rootAbstract.fallbackUsed && rootAbstract.fallbackReason) {
      fallbackEvents.push(rootAbstract.fallbackReason)
    }

    const doc: LayeredContextIndexDocument = {
      version: 1,
      sessionKey: input.sessionKey,
      root: {
        id: 'root',
        abstract: rootAbstract.text,
        summary: rootSummary.text,
        keywords: extractTopKeywords(
          `${rootAbstract.text}\n${rootSummary.text}\n${kept.flatMap((node) => node.keywords).join(' ')}`
        ),
        childIds: kept.map((node) => node.id),
        updatedAt: now
      },
      nodes: kept,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now
    }

    await this.storage.saveIndex(doc)
    await this.storage.cleanupArchives(input.sessionKey, new Set(kept.map((node) => node.id)))

    return {
      index: doc,
      fallbackEvents
    }
  }
}
