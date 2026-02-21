import type Anthropic from '@anthropic-ai/sdk'
import type { ContextLayer, LayeredContextConfig } from '../../src/main/services/agent/context/layered/types'

export interface ContextEvalCaseMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface ContextEvalCaseLabels {
  expectedEvidence?: string[]
  expectedLayerMin?: ContextLayer
  referenceAnswer?: string
  tags?: string[]
}

export interface ContextEvalCase {
  id: string
  query: string
  messages: ContextEvalCaseMessage[]
  platform?: string
  chatId?: string | null
  labels?: ContextEvalCaseLabels
  metadata?: Record<string, unknown>
}

export interface NormalizedContextEvalCase {
  id: string
  query: string
  messages: Anthropic.MessageParam[]
  platform: string
  chatId: string | null
  labels: ContextEvalCaseLabels
  metadata?: Record<string, unknown>
}

export interface EvalRunnerConfig {
  datasetPath: string
  outputDir: string
  runId: string
  maxCases: number | null
  layeredConfig: LayeredContextConfig
}

export interface EvidenceScore {
  recall: number
  hitEvidence: string[]
  missingEvidence: string[]
}

export interface EvaluatedVariant {
  promptTokens: number
  messageCount: number
  contextText: string
  contextPreview: string
  evidenceScore: EvidenceScore | null
  layeredApplied: boolean
  reachedLayer: ContextLayer | null
  decisionReason: string | null
  retrievalTokenUsage: {
    l0: number
    l1: number
    l2: number
    total: number
    baselineL2: number
    savings: number
    savingsRatio: number
  } | null
}

export interface CaseEvaluationResult {
  caseId: string
  query: string
  expectedEvidenceCount: number
  expectedLayerMin: ContextLayer | null
  baseline: EvaluatedVariant
  candidate: EvaluatedVariant
  promptTokenSavingsRatio: number
  evidenceRecallDelta: number | null
  layerAdequacyPass: boolean | null
  informationLossIncident: boolean | null
  explanation: string[]
}

export interface DistributionStats {
  mean: number
  p50: number
  p95: number
  min: number
  max: number
}

export interface DeltaWithConfidenceInterval {
  mean: number
  lower95: number
  upper95: number
  sampleCount: number
}

export interface ContextEvalSummary {
  runId: string
  generatedAt: string
  datasetPath: string
  outputDir: string
  caseCount: number
  config: {
    maxCases: number | null
    layeredConfig: LayeredContextConfig
  }
  metrics: {
    promptTokens: {
      baseline: DistributionStats
      candidate: DistributionStats
      savingsRatio: DistributionStats
    }
    evidenceRecall: {
      baseline: DistributionStats | null
      candidate: DistributionStats | null
      delta: DeltaWithConfidenceInterval | null
    }
    layerAdequacyRate: number | null
    informationLossRate: number | null
    regressionCases: number
    stableOrImprovedCases: number
    layeredApplication: {
      appliedCaseCount: number
      applyRate: number
      promptTokensWhenApplied: {
        baseline: DistributionStats
        candidate: DistributionStats
        savingsRatio: DistributionStats
      } | null
    }
  }
}

export interface WriteArtifactsResult {
  runDirectory: string
  summaryJsonPath: string
  summaryMarkdownPath: string
  casesCsvPath: string
  regressionsPath: string
  latestPointerPath: string
}

