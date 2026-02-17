import type Anthropic from '@anthropic-ai/sdk'

export type ContextLayer = 'L0' | 'L1' | 'L2'

export interface RetrievalEscalationThresholds {
  scoreThresholdHigh: number
  top1Top2Margin: number
  maxItemsForL1: number
  maxItemsForL2: number
}

export interface LayeredContextConfig {
  l0TargetTokens: number
  l1TargetTokens: number
  maxPromptTokens: number
  retrievalEscalationThresholds: RetrievalEscalationThresholds
  enableSessionCompression: boolean
  maxArchives: number
  maxRecentMessages: number
  archiveChunkSize: number
}

export interface LayeredContextNodeMetadata {
  platform: string
  chatId: string | null
  startMessageIndex: number
  endMessageIndex: number
  messageCount: number
  recencyRank: number
}

export interface LayeredContextNode {
  id: string
  parentId: 'root' | null
  abstract: string
  overview: string
  fullContentPath: string
  keywords: string[]
  checksum: string
  metadata: LayeredContextNodeMetadata
  tokenEstimate: {
    l0: number
    l1: number
    l2: number
  }
  createdAt: number
  updatedAt: number
}

export interface LayeredContextRoot {
  id: 'root'
  abstract: string
  overview: string
  keywords: string[]
  childIds: string[]
  updatedAt: number
}

export interface LayeredContextIndexDocument {
  version: 1
  sessionKey: string
  root: LayeredContextRoot
  nodes: LayeredContextNode[]
  createdAt: number
  updatedAt: number
}

export interface LayeredContextArchivePayload {
  sessionKey: string
  nodeId: string
  transcript: string
  messages: Anthropic.MessageParam[]
  createdAt: number
}

export interface LayeredContextSelection {
  nodeId: string
  layer: ContextLayer
  content: string
  score: number
  estimatedTokens: number
  reason: string
}

export interface EscalationDecision {
  reachedLayer: ContextLayer
  reason: string
  top1Score: number
  top1Top2Margin: number
  queryMode: 'broad' | 'structured' | 'precise'
}

export interface LayeredRetrievalResult {
  selections: LayeredContextSelection[]
  decision: EscalationDecision
  tokenUsage: {
    l0: number
    l1: number
    l2: number
    total: number
    baselineL2: number
    savings: number
    savingsRatio: number
  }
}

export interface LayeredIndexBuildResult {
  index: LayeredContextIndexDocument
  fallbackEvents: string[]
}

export interface LayeredContextApplicationResult {
  applied: boolean
  updatedMessages: Anthropic.MessageParam[]
  retrieval: LayeredRetrievalResult | null
  fallbackEvents: string[]
  archivedMessageCount: number
}
