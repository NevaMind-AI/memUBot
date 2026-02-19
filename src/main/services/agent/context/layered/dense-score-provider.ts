import {
  normalizeDenseScore,
  normalizeWhitespace
} from './text-utils'

const REQUEST_TIMEOUT_MS = 1200
const EMBEDDING_ENDPOINTS = ['/api/v3/yumi/voyage/v1/embeddings', '/api/v3/yumi/embedding'] as const

export interface MemuConfig {
  baseUrl: string
  apiKey: string
}

interface ParsedEmbeddingItem {
  index: number
  vector: number[]
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

interface MemuDenseScoreProviderOptions {
  requestTimeoutMs?: number
  fetchImpl?: typeof fetch
  resolveConfig?: () => Promise<MemuConfig | null>
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(1, value))
}

function getAppMode(): 'memu' | 'yumi' {
  const modeFromVite = import.meta.env?.MAIN_VITE_APP_MODE
  const modeFromProcess = process.env.APP_MODE
  return (modeFromVite || modeFromProcess || 'memu') as 'memu' | 'yumi'
}

async function getMemuConfig(): Promise<MemuConfig> {
  const { loadSettings } = await import('../../../../config/settings.config')
  const settings = await loadSettings()
  const mode = getAppMode()

  let apiKey = settings.memuApiKey

  try {
    const { getAuthService } = await import('../../../auth')
    const authState = getAuthService().getAuthState()
    const authApiKey = authState.memuApiKey?.trim()
    if (authApiKey) {
      apiKey = authApiKey
    } else if (mode === 'yumi') {
      apiKey = ''
    }
  } catch {
    if (mode === 'yumi') {
      apiKey = ''
    }
  }

  return {
    baseUrl: settings.memuBaseUrl,
    apiKey
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

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '')
}

function parseNumberArray(value: unknown): number[] | null {
  if (!Array.isArray(value) || value.length === 0) {
    return null
  }

  const vector: number[] = []
  for (const item of value) {
    const num = extractNumber(item)
    if (num === null) {
      return null
    }
    vector.push(num)
  }
  return vector
}

function extractVector(value: unknown): number[] | null {
  const direct = parseNumberArray(value)
  if (direct) return direct

  const obj = asRecord(value)
  if (!obj) return null

  const fields = ['embedding', 'vector', 'values']
  for (const field of fields) {
    const parsed = parseNumberArray(obj[field])
    if (parsed) return parsed
  }

  const nestedData = asRecord(obj['data'])
  if (!nestedData) return null
  for (const field of fields) {
    const parsed = parseNumberArray(nestedData[field])
    if (parsed) return parsed
  }

  return null
}

function parseEmbeddingItems(payload: unknown): ParsedEmbeddingItem[] {
  const root = asRecord(payload)
  const arrays: unknown[][] = []

  if (Array.isArray(payload)) {
    arrays.push(payload)
  }

  if (root) {
    const directCandidates = [root['data'], root['embeddings'], root['results']]
    for (const candidate of directCandidates) {
      if (Array.isArray(candidate)) {
        arrays.push(candidate)
      }
    }

    const nestedData = asRecord(root['data'])
    if (nestedData) {
      const nestedCandidates = [nestedData['data'], nestedData['embeddings'], nestedData['results']]
      for (const candidate of nestedCandidates) {
        if (Array.isArray(candidate)) {
          arrays.push(candidate)
        }
      }
    }
  }

  const sourceItems = arrays.find((entry) => entry.length > 0)
  if (!sourceItems) return []

  const parsedItems: ParsedEmbeddingItem[] = []
  for (let i = 0; i < sourceItems.length; i++) {
    const rawItem = sourceItems[i]
    const vector = extractVector(rawItem)
    if (!vector) continue

    const obj = asRecord(rawItem)
    const rawIndex = obj
      ? extractNumber(obj['index']) ?? extractNumber(obj['input_index']) ?? extractNumber(obj['position'])
      : null
    const index = rawIndex !== null && rawIndex >= 0 ? Math.floor(rawIndex) : i

    parsedItems.push({ index, vector })
  }

  parsedItems.sort((a, b) => a.index - b.index)
  return parsedItems
}

function calculateCosineSimilarity(left: number[], right: number[]): number {
  const dimensions = Math.min(left.length, right.length)
  if (dimensions === 0) return 0

  let dot = 0
  let leftNorm = 0
  let rightNorm = 0

  for (let i = 0; i < dimensions; i++) {
    const leftValue = left[i]
    const rightValue = right[i]
    dot += leftValue * rightValue
    leftNorm += leftValue * leftValue
    rightNorm += rightValue * rightValue
  }

  if (leftNorm === 0 || rightNorm === 0) {
    return 0
  }

  return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm))
}

async function requestEmbeddings(
  config: MemuConfig,
  input: string[],
  signal: AbortSignal,
  fetchImpl: typeof fetch
): Promise<ParsedEmbeddingItem[]> {
  const requestBody = JSON.stringify({ input })

  for (const endpoint of EMBEDDING_ENDPOINTS) {
    try {
      const response = await fetchImpl(`${normalizeBaseUrl(config.baseUrl)}${endpoint}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: requestBody,
        signal
      })

      if (!response.ok) {
        continue
      }

      const payload = (await response.json()) as unknown
      const embeddings = parseEmbeddingItems(payload)
      if (embeddings.length > 0) {
        return embeddings
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw error
      }
    }
  }

  return []
}

export class MemuDenseScoreProvider implements LayeredDenseScoreProvider {
  constructor(private readonly options: MemuDenseScoreProviderOptions = {}) {}

  async getDenseScores(input: DenseScoreRequest): Promise<Map<string, number>> {
    if (input.candidates.length === 0) {
      return new Map()
    }

    let config: MemuConfig | null
    try {
      config = this.options.resolveConfig ? await this.options.resolveConfig() : await getMemuConfig()
    } catch {
      return new Map()
    }

    if (!config || !config.apiKey || !config.baseUrl) {
      return new Map()
    }

    const requestTimeoutMs = this.options.requestTimeoutMs ?? REQUEST_TIMEOUT_MS
    const fetchImpl = this.options.fetchImpl ?? fetch
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), requestTimeoutMs)

    try {
      const normalizedQuery = normalizeWhitespace(input.query)
      if (!normalizedQuery) {
        return new Map()
      }

      const normalizedCandidates = input.candidates.map((candidate) => ({
        ...candidate,
        content: normalizeWhitespace(candidate.content)
      }))
      const requestInput = [normalizedQuery, ...normalizedCandidates.map((candidate) => candidate.content)]
      const embeddings = await requestEmbeddings(config, requestInput, controller.signal, fetchImpl)
      if (embeddings.length === 0) {
        return new Map()
      }

      const vectorByIndex = new Map<number, number[]>()
      for (const item of embeddings) {
        vectorByIndex.set(item.index, item.vector)
      }

      const queryVector = vectorByIndex.get(0)
      if (!queryVector) {
        return new Map()
      }

      const scores = new Map<string, number>()
      for (let i = 0; i < normalizedCandidates.length; i++) {
        const candidate = normalizedCandidates[i]
        const candidateVector = vectorByIndex.get(i + 1)
        if (!candidateVector) continue

        const cosine = calculateCosineSimilarity(queryVector, candidateVector)
        const score = clamp01(normalizeDenseScore(cosine, 'cosine'))
        scores.set(candidate.nodeId, score)
      }

      return scores
    } catch {
      return new Map()
    } finally {
      clearTimeout(timeout)
    }
  }
}
