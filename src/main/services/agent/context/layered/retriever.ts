import { estimateTextTokens } from '../token-estimator'
import type {
  EscalationDecision,
  LayeredContextConfig,
  LayeredContextIndexDocument,
  LayeredContextSelection,
  LayeredRetrievalResult
} from './types'
import { estimateSimilarity } from './text-utils'
import type { LayeredContextStorage } from './storage'

interface ScoredNode {
  nodeId: string
  l0Score: number
  l1Score: number
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
  constructor(private readonly storage: LayeredContextStorage) {}

  async retrieve(
    index: LayeredContextIndexDocument,
    query: string,
    config: LayeredContextConfig
  ): Promise<LayeredRetrievalResult> {
    const baselineL2 = index.nodes.reduce((sum, node) => sum + node.tokenEstimate.l2, 0)
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

    const scored: ScoredNode[] = index.nodes
      .map((node) => ({
        nodeId: node.id,
        l0Score: estimateSimilarity(query, `${node.abstract}\n${node.keywords.join(' ')}`),
        l1Score: 0
      }))
      .sort((a, b) => b.l0Score - a.l0Score)

    const top1 = scored[0]?.l0Score ?? 0
    const top2 = scored[1]?.l0Score ?? 0
    const margin = top1 - top2
    const thresholds = config.retrievalEscalationThresholds
    const queryMode = classifyQuery(query)
    const highConfidence = top1 >= thresholds.scoreThresholdHigh && margin >= thresholds.top1Top2Margin

    let reachedLayer: 'L0' | 'L1' | 'L2' = 'L0'
    let reason = 'High confidence on L0 retrieval.'

    if (!highConfidence || queryMode !== 'broad') {
      const l1Candidates = scored.slice(0, thresholds.maxItemsForL1).map((candidate) => {
        const node = index.nodes.find((item) => item.id === candidate.nodeId)
        if (!node) return candidate
        return {
          ...candidate,
          l1Score: estimateSimilarity(query, `${node.overview}\n${node.keywords.join(' ')}`)
        }
      })

      l1Candidates.sort((a, b) => b.l1Score - a.l1Score)
      const l1Top1 = l1Candidates[0]?.l1Score ?? 0
      const l1Top2 = l1Candidates[1]?.l1Score ?? 0
      const l1Margin = l1Top1 - l1Top2

      const l1Confidence = l1Top1 >= thresholds.scoreThresholdHigh * 0.9 && l1Margin >= thresholds.top1Top2Margin * 0.5
      if (queryMode !== 'precise' && l1Confidence) {
        reachedLayer = 'L1'
        reason = 'L0 confidence is insufficient; L1 confidence is acceptable.'
      } else {
        reachedLayer = 'L2'
        reason = 'Precise query or low confidence after L1; L2 escalation required.'
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
      if (usedTokens + estimatedTokens > config.maxPromptTokens) {
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
      pushSelection('root', 'L0', index.root.abstract, top1, 'Global context summary for navigation.')
    }

    if (reachedLayer === 'L0') {
      for (const candidate of scored.slice(0, 3)) {
        const node = index.nodes.find((item) => item.id === candidate.nodeId)
        if (!node) continue
        const ok = pushSelection(node.id, 'L0', node.abstract, candidate.l0Score, 'High L0 match.')
        if (!ok) break
      }
    } else if (reachedLayer === 'L1') {
      for (const candidate of scored.slice(0, thresholds.maxItemsForL1)) {
        const node = index.nodes.find((item) => item.id === candidate.nodeId)
        if (!node) continue
        const score = candidate.l1Score || candidate.l0Score
        const ok = pushSelection(node.id, 'L1', node.overview, score, 'L1 contextual understanding required.')
        if (!ok) break
      }
    } else {
      const l1Carry = Math.max(1, thresholds.maxItemsForL1 - thresholds.maxItemsForL2)
      for (const candidate of scored.slice(0, l1Carry)) {
        const node = index.nodes.find((item) => item.id === candidate.nodeId)
        if (!node) continue
        const score = candidate.l1Score || candidate.l0Score
        const ok = pushSelection(node.id, 'L1', node.overview, score, 'Carry L1 scope context before L2 evidence.')
        if (!ok) break
      }

      const l2Candidates = scored.slice(0, thresholds.maxItemsForL2)
      for (const candidate of l2Candidates) {
        const node = index.nodes.find((item) => item.id === candidate.nodeId)
        if (!node) continue
        const archive = await this.storage.readArchive(node.fullContentPath)
        if (!archive) continue

        const l2Score = estimateSimilarity(query, archive.transcript)
        const ok = pushSelection(node.id, 'L2', archive.transcript, l2Score, 'L2 exact evidence retrieval.')
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
