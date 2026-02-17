import { getAuthService } from '../../../auth'
import { loadSettings } from '../../../../config/settings.config'
import {
  estimateSimilarity,
  normalizeDenseScore,
  normalizeWhitespace,
  type DenseDistanceMetric
} from './text-utils'

const REQUEST_TIMEOUT_MS = 1200
const MAX_ITEMS = 32

interface MemuConfig {
  baseUrl: string
  apiKey: string
  userId: string
  agentId: string
}

interface ParsedMemuItem {
  score: number
  text: string
}

export interface DenseScoreCandidate {
  nodeId: string
  content: string
}

export interface DenseScoreRequest {
  query: string
  candidates: DenseScoreCandidate[]
}

export interface LayeredDenseScoreProvider {
  getDenseScores(input: DenseScoreRequest): Promise<Map<string, number>>
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(1, value))
}

function getAppMode(): 'memu' | 'yumi' {
  return (import.meta.env?.MAIN_VITE_APP_MODE as 'memu' | 'yumi') || 'memu'
}

async function getMemuConfig(): Promise<MemuConfig> {
  const settings = await loadSettings()
  const mode = getAppMode()

  if (mode === 'memu') {
    return {
      baseUrl: settings.memuBaseUrl,
      apiKey: settings.memuApiKey,
      userId: settings.memuUserId,
      agentId: settings.memuAgentId
    }
  }

  const authState = getAuthService().getAuthState()
  return {
    baseUrl: settings.memuBaseUrl,
    apiKey: authState.memuApiKey ?? '',
    userId: settings.memuYumiUserId,
    agentId: settings.memuYumiAgentId
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') return null
  return value as Record<string, unknown>
}

function extractNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

function extractText(value: unknown): string {
  if (typeof value === 'string') {
    return normalizeWhitespace(value)
  }

  if (Array.isArray(value)) {
    return normalizeWhitespace(value.map((item) => extractText(item)).filter(Boolean).join('\n'))
  }

  const obj = asRecord(value)
  if (!obj) return ''

  const directFields = ['content', 'text', 'summary', 'chunk', 'passage', 'memory']
  for (const field of directFields) {
    const text = extractText(obj[field])
    if (text) return text
  }

  return ''
}

function normalizeScore(raw: number, metric: DenseDistanceMetric): number {
  if (metric === 'l2') {
    return normalizeDenseScore(raw, 'l2')
  }

  if (raw >= 0 && raw <= 1) {
    return raw
  }

  if (raw >= -1 && raw <= 1) {
    return normalizeDenseScore(raw, 'cosine')
  }

  return normalizeDenseScore(raw, 'ip')
}

function parseItemScore(item: Record<string, unknown>): number {
  const l2Fields = ['distance', 'l2_distance', 'dist']
  for (const key of l2Fields) {
    const raw = extractNumber(item[key])
    if (raw !== null) {
      return normalizeScore(raw, 'l2')
    }
  }

  const scoreFields = ['_score', 'score', 'relevance_score', 'similarity', 'cosine']
  for (const key of scoreFields) {
    const raw = extractNumber(item[key])
    if (raw !== null) {
      return normalizeScore(raw, 'cosine')
    }
  }

  const meta = asRecord(item.metadata)
  if (meta) {
    for (const key of ['_score', 'score', 'relevance_score']) {
      const raw = extractNumber(meta[key])
      if (raw !== null) {
        return normalizeScore(raw, 'cosine')
      }
    }
  }

  return 0
}

function parseMemuItems(payload: unknown): ParsedMemuItem[] {
  const root = asRecord(payload)
  const maybeArrays: unknown[] = []

  if (Array.isArray(payload)) {
    maybeArrays.push(payload)
  } else if (root) {
    maybeArrays.push(root.items, root.results, root.memories)
    const data = asRecord(root.data)
    if (data) {
      maybeArrays.push(data.items, data.results, data.memories)
    } else {
      maybeArrays.push(root.data)
    }
  }

  const items = maybeArrays.find((entry) => Array.isArray(entry))
  if (!Array.isArray(items)) return []

  const parsed: ParsedMemuItem[] = []
  for (const rawItem of items.slice(0, MAX_ITEMS)) {
    const item = asRecord(rawItem)
    if (!item) continue
    const text = extractText(rawItem)
    if (!text) continue
    const score = parseItemScore(item)
    parsed.push({ score: clamp01(score), text })
  }
  return parsed
}

function mapItemScoresToCandidates(candidates: DenseScoreCandidate[], items: ParsedMemuItem[]): Map<string, number> {
  const scores = new Map<string, number>()
  if (items.length === 0) return scores

  for (const candidate of candidates) {
    let best = 0
    for (const item of items) {
      const alignment = estimateSimilarity(candidate.content, item.text)
      if (alignment <= 0) continue
      const mappedScore = clamp01(item.score * alignment)
      if (mappedScore > best) {
        best = mappedScore
      }
    }
    scores.set(candidate.nodeId, best)
  }

  return scores
}

export class MemuDenseScoreProvider implements LayeredDenseScoreProvider {
  async getDenseScores(input: DenseScoreRequest): Promise<Map<string, number>> {
    if (input.candidates.length === 0) {
      return new Map()
    }

    let config: MemuConfig
    try {
      config = await getMemuConfig()
    } catch {
      return new Map()
    }

    if (!config.apiKey || !config.baseUrl) {
      return new Map()
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

    try {
      const response = await fetch(`${config.baseUrl}/api/v3/memory/retrieve`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          user_id: config.userId,
          agent_id: config.agentId,
          query: input.query
        }),
        signal: controller.signal
      })

      if (!response.ok) {
        return new Map()
      }

      const payload = (await response.json()) as unknown
      const items = parseMemuItems(payload)
      return mapItemScoresToCandidates(input.candidates, items)
    } catch {
      return new Map()
    } finally {
      clearTimeout(timeout)
    }
  }
}
