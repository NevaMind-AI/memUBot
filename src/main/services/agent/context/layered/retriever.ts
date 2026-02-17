import { estimateTextTokens } from '../token-estimator'
import type {
  EscalationDecision,
  LayeredContextConfig,
  LayeredContextIndexDocument,
  LayeredContextSelection,
  LayeredRetrievalResult
} from './types'
import {
  blendDenseSparseScores,
  buildBm25Model,
  estimateSimilarity,
  scoreBm25Batch,
  tokenize
} from './text-utils'
import type { LayeredContextStorage } from './storage'
import type { LayeredDenseScoreProvider } from './dense-score-provider'

interface ScoredNode {
  nodeId: string
  l0Score: number
  l1Score: number
}

const SEARCH_WITH_SPARSE_LOGIT_ALPHA = 0.35
const RECENCY_PRIOR_MAX = 0.08
const LAYERED_CONTEXT_BUDGET_RATIO = 0.45

function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function calculateRecencyPrior(recencyRank: number, totalNodes: number): number {
  if (totalNodes <= 0 || recencyRank <= 0) return 0
  const normalizedRank = (totalNodes - recencyRank + 1) / totalNodes
  return normalizedRank * RECENCY_PRIOR_MAX
}

function scoreLayerContent(
  sparseScore: number,
  denseScore: number | undefined,
  recencyRank: number,
  totalNodes: number
): number {
  const denseFromSource = denseScore ?? sparseScore
  const blendedScore = blendDenseSparseScores(denseFromSource, sparseScore, SEARCH_WITH_SPARSE_LOGIT_ALPHA)
  const recencyPrior = calculateRecencyPrior(recencyRank, totalNodes)
  return clampNumber(blendedScore + recencyPrior, 0, 1)
}

function buildAdaptiveThresholds(
  config: LayeredContextConfig,
  queryMode: 'broad' | 'structured' | 'precise',
  query: string
): {
  scoreThresholdHigh: number
  top1Top2Margin: number
  maxItemsForL1: number
  maxItemsForL2: number
} {
  const base = config.retrievalEscalationThresholds
  const queryTokenCount = tokenize(query).length

  let scoreThresholdHigh = base.scoreThresholdHigh
  let top1Top2Margin = base.top1Top2Margin

  if (queryMode === 'precise') {
    scoreThresholdHigh *= 0.92
    top1Top2Margin *= 0.8
  } else if (queryMode === 'structured') {
    scoreThresholdHigh *= 0.97
  }

  if (queryTokenCount <= 5) {
    scoreThresholdHigh *= 0.88
    top1Top2Margin *= 0.72
  } else if (queryTokenCount >= 12) {
    scoreThresholdHigh *= 1.04
    top1Top2Margin *= 1.1
  }

  return {
    scoreThresholdHigh: clampNumber(scoreThresholdHigh, 0.1, 0.99),
    top1Top2Margin: clampNumber(top1Top2Margin, 0.01, 0.8),
    maxItemsForL1: Math.max(1, Math.floor(base.maxItemsForL1)),
    maxItemsForL2: Math.max(1, Math.floor(base.maxItemsForL2))
  }
}

function classifyQuery(query: string): 'broad' | 'structured' | 'precise' {
  const normalized = query.toLowerCase()
  const preciseSignals = [
    'exact',
    'line',
    'stack',
    'error',
    'exception',
    'snippet',
    'parameter',
    'argument',
    'function',
    'class',
    'api',
    'status code',
    'trace',
    '`',
    '.ts',
    '.js',
    '.json',
    '/'
  ]
  if (preciseSignals.some((signal) => normalized.includes(signal))) {
    return 'precise'
  }

  const structuredSignals = ['overview', 'summary', 'architecture', 'flow', 'design', 'scope', 'roadmap']
  if (structuredSignals.some((signal) => normalized.includes(signal))) {
    return 'structured'
  }

  return 'broad'
}

function buildDecision(
  reachedLayer: 'L0' | 'L1' | 'L2',
  reason: string,
  top1Score: number,
  top1Top2Margin: number,
  queryMode: 'broad' | 'structured' | 'precise'
): EscalationDecision {
  return {
    reachedLayer,
    reason,
    top1Score,
    top1Top2Margin,
    queryMode
  }
}

export class LayeredContextRetriever {
  constructor(
    private readonly storage: LayeredContextStorage,
    private readonly denseScoreProvider?: LayeredDenseScoreProvider
  ) {}

  async retrieve(
    index: LayeredContextIndexDocument,
    query: string,
    config: LayeredContextConfig
  ): Promise<LayeredRetrievalResult> {
    const baselineL2 = index.nodes.reduce((sum, node) => sum + node.tokenEstimate.l2, 0)
    const nodeById = new Map(index.nodes.map((node) => [node.id, node]))
    const totalNodes = index.nodes.length
    if (index.nodes.length === 0) {
      return {
        selections: [],
        decision: buildDecision('L0', 'No archived nodes are available.', 0, 0, 'broad'),
        tokenUsage: {
          l0: 0,
          l1: 0,
          l2: 0,
          total: 0,
          baselineL2,
          savings: baselineL2,
          savingsRatio: baselineL2 > 0 ? 1 : 0
        }
      }
    }

    const queryMode = classifyQuery(query)
    const thresholds = buildAdaptiveThresholds(config, queryMode, query)
    const layeredBudget = Math.max(400, Math.floor(config.maxPromptTokens * LAYERED_CONTEXT_BUDGET_RATIO))
    const denseCandidates = [
      {
        nodeId: 'root',
        content: `${index.root.abstract}\n${index.root.keywords.join(' ')}`
      },
      ...index.nodes.map((node) => ({
        nodeId: node.id,
        content: `${node.abstract}\n${node.keywords.join(' ')}`
      }))
    ]
    const denseScores = this.denseScoreProvider
      ? await this.denseScoreProvider.getDenseScores({ query, candidates: denseCandidates })
      : new Map<string, number>()
    const l0SparseScores = scoreBm25Batch(
      buildBm25Model([
        {
          id: 'root',
          content: `${index.root.abstract}\n${index.root.keywords.join(' ')}`
        },
        ...index.nodes.map((node) => ({
          id: node.id,
          content: `${node.abstract}\n${node.keywords.join(' ')}`
        }))
      ]),
      query
    )

    const scored: ScoredNode[] = index.nodes
      .map((node) => ({
        nodeId: node.id,
        // Sparse score is now BM25-based across all L0 candidates.
        // Fallback to pairwise estimateSimilarity to guard edge cases.
        // This keeps retrieval stable even if model construction returns empty.
        l0Score: scoreLayerContent(
          l0SparseScores.get(node.id) ?? estimateSimilarity(query, `${node.abstract}\n${node.keywords.join(' ')}`),
          denseScores.get(node.id),
          node.metadata.recencyRank,
          totalNodes
        ),
        l1Score: 0
      }))
      .sort((a, b) => b.l0Score - a.l0Score)

    const top1 = scored[0]?.l0Score ?? 0
    const top2 = scored[1]?.l0Score ?? 0
    const margin = top1 - top2
    const highConfidence = top1 >= thresholds.scoreThresholdHigh && margin >= thresholds.top1Top2Margin

    let reachedLayer: 'L0' | 'L1' | 'L2' = 'L0'
    let reason = 'High confidence on L0 retrieval after hybrid scoring.'

    if (!highConfidence || queryMode !== 'broad') {
      const l1Ranked = scored.slice(0, thresholds.maxItemsForL1)
      const l1SparseScores = scoreBm25Batch(
        buildBm25Model(
          l1Ranked.flatMap((candidate) => {
            const node = nodeById.get(candidate.nodeId)
            if (!node) return []
            return [{ id: node.id, content: `${node.overview}\n${node.keywords.join(' ')}` }]
          })
        ),
        query
      )

      const l1Candidates = l1Ranked.map((candidate) => {
        const node = nodeById.get(candidate.nodeId)
        if (!node) return candidate
        return {
          ...candidate,
          l1Score: scoreLayerContent(
            l1SparseScores.get(node.id) ?? l0SparseScores.get(node.id) ?? 0,
            denseScores.get(node.id),
            node.metadata.recencyRank,
            totalNodes
          )
        }
      })

      l1Candidates.sort((a, b) => b.l1Score - a.l1Score)
      const l1Top1 = l1Candidates[0]?.l1Score ?? 0
      const l1Top2 = l1Candidates[1]?.l1Score ?? 0
      const l1Margin = l1Top1 - l1Top2

      const l1Confidence = l1Top1 >= thresholds.scoreThresholdHigh * 0.9 && l1Margin >= thresholds.top1Top2Margin * 0.5
      if (queryMode !== 'precise' && l1Confidence) {
        reachedLayer = 'L1'
        reason = 'L0 confidence is insufficient; L1 confidence is acceptable after hybrid rerank.'
      } else {
        reachedLayer = 'L2'
        reason = 'Precise query or low confidence after L1; L2 escalation required for evidence.'
      }

      for (const candidate of l1Candidates) {
        const found = scored.find((item) => item.nodeId === candidate.nodeId)
        if (found) {
          found.l1Score = candidate.l1Score
        }
      }
      scored.sort((a, b) => (b.l1Score || b.l0Score) - (a.l1Score || a.l0Score))
    }

    const selections: LayeredContextSelection[] = []
    let usedTokens = 0

    const pushSelection = (
      nodeId: string,
      layer: 'L0' | 'L1' | 'L2',
      content: string,
      score: number,
      selectionReason: string
    ): boolean => {
      const estimatedTokens = estimateTextTokens(content)
      if (usedTokens + estimatedTokens > layeredBudget) {
        return false
      }
      usedTokens += estimatedTokens
      selections.push({
        nodeId,
        layer,
        content,
        score,
        estimatedTokens,
        reason: selectionReason
      })
      return true
    }

    if (index.root.abstract) {
      const rootScore = scoreLayerContent(
        l0SparseScores.get('root') ?? estimateSimilarity(query, `${index.root.abstract}\n${index.root.keywords.join(' ')}`),
        denseScores.get('root'),
        1,
        Math.max(totalNodes, 1)
      )
      pushSelection('root', 'L0', index.root.abstract, rootScore, 'Global context summary for navigation.')
    }

    if (reachedLayer === 'L0') {
      for (const candidate of scored.slice(0, 3)) {
        const node = nodeById.get(candidate.nodeId)
        if (!node) continue
        const ok = pushSelection(node.id, 'L0', node.abstract, candidate.l0Score, 'High L0 match.')
        if (!ok) break
      }
    } else if (reachedLayer === 'L1') {
      for (const candidate of scored.slice(0, thresholds.maxItemsForL1)) {
        const node = nodeById.get(candidate.nodeId)
        if (!node) continue
        const score = candidate.l1Score || candidate.l0Score
        const ok = pushSelection(node.id, 'L1', node.overview, score, 'L1 contextual understanding required.')
        if (!ok) break
      }
    } else {
      const l1Carry = Math.max(1, thresholds.maxItemsForL1 - thresholds.maxItemsForL2)
      for (const candidate of scored.slice(0, l1Carry)) {
        const node = nodeById.get(candidate.nodeId)
        if (!node) continue
        const score = candidate.l1Score || candidate.l0Score
        const ok = pushSelection(node.id, 'L1', node.overview, score, 'Carry L1 scope context before L2 evidence.')
        if (!ok) break
      }

      const l2Candidates = scored.slice(0, thresholds.maxItemsForL2)
      const l2Transcripts: Array<{ nodeId: string; transcript: string }> = []
      for (const candidate of l2Candidates) {
        const node = nodeById.get(candidate.nodeId)
        if (!node) continue
        const archive = await this.storage.readArchive(node.fullContentPath)
        if (!archive) continue
        l2Transcripts.push({
          nodeId: node.id,
          transcript: archive.transcript
        })
      }
      const l2SparseScores = scoreBm25Batch(
        buildBm25Model(l2Transcripts.map((item) => ({ id: item.nodeId, content: item.transcript }))),
        query
      )

      for (const item of l2Transcripts) {
        const node = nodeById.get(item.nodeId)
        if (!node) continue
        const l2SparseScore = l2SparseScores.get(node.id) ?? estimateSimilarity(query, item.transcript)
        const l2Score = scoreLayerContent(l2SparseScore, denseScores.get(node.id), node.metadata.recencyRank, totalNodes)
        const ok = pushSelection(node.id, 'L2', item.transcript, l2Score, 'L2 exact evidence retrieval.')
        if (!ok) break
      }
    }

    const l0 = selections.filter((item) => item.layer === 'L0').reduce((sum, item) => sum + item.estimatedTokens, 0)
    const l1 = selections.filter((item) => item.layer === 'L1').reduce((sum, item) => sum + item.estimatedTokens, 0)
    const l2 = selections.filter((item) => item.layer === 'L2').reduce((sum, item) => sum + item.estimatedTokens, 0)
    const total = l0 + l1 + l2
    const savings = baselineL2 - total
    const savingsRatio = baselineL2 > 0 ? savings / baselineL2 : 0

    return {
      selections,
      decision: buildDecision(reachedLayer, reason, top1, margin, queryMode),
      tokenUsage: {
        l0,
        l1,
        l2,
        total,
        baselineL2,
        savings,
        savingsRatio
      }
    }
  }
}
