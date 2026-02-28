import type { AppSettings } from '../../../../config/settings.config'
import type { LayeredContextConfig, RetrievalEscalationThresholds } from './types'

function clampNumber(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min
  return Math.max(min, Math.min(max, value))
}

export const DEFAULT_RETRIEVAL_ESCALATION_THRESHOLDS: RetrievalEscalationThresholds = {
  scoreThresholdHigh: 0.64,
  top1Top2Margin: 0.08,
  maxItemsForL1: 4,
  maxItemsForL2: 2
}

export const DEFAULT_LAYERED_CONTEXT_CONFIG: LayeredContextConfig = {
  l0TargetTokens: 120,
  l1TargetTokens: 1200,
  maxPromptTokens: 32000,
  retrievalEscalationThresholds: DEFAULT_RETRIEVAL_ESCALATION_THRESHOLDS,
  enableSessionCompression: true,
  maxArchives: 12,
  maxRecentMessages: 24,
  archiveChunkSize: 8
}

export function getLayeredContextConfig(settings: AppSettings): LayeredContextConfig {
  const thresholds = settings.retrievalEscalationThresholds ?? DEFAULT_RETRIEVAL_ESCALATION_THRESHOLDS

  return {
    l0TargetTokens: clampNumber(settings.l0TargetTokens, 40, 300),
    l1TargetTokens: clampNumber(settings.l1TargetTokens, 300, 4000),
    maxPromptTokens: clampNumber(settings.maxPromptTokens, 4000, 160000),
    retrievalEscalationThresholds: {
      scoreThresholdHigh: clampNumber(thresholds.scoreThresholdHigh, 0.1, 0.99),
      top1Top2Margin: clampNumber(thresholds.top1Top2Margin, 0.01, 0.8),
      maxItemsForL1: Math.floor(clampNumber(thresholds.maxItemsForL1, 1, 12)),
      maxItemsForL2: Math.floor(clampNumber(thresholds.maxItemsForL2, 1, 6))
    },
    enableSessionCompression: settings.enableSessionCompression,
    maxArchives: Math.floor(clampNumber(settings.maxArchives, 1, 60)),
    maxRecentMessages: Math.floor(clampNumber(settings.maxRecentMessages, 2, 120)),
    archiveChunkSize: Math.floor(clampNumber(settings.archiveChunkSize, 2, 30))
  }
}
