import { estimateTextTokens } from '../token-estimator'

const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'to', 'for', 'of', 'in', 'on', 'at', 'is', 'are',
  'was', 'were', 'be', 'been', 'this', 'that', 'it', 'as', 'with', 'by', 'from',
  'about', 'into', 'through', 'can', 'could', 'should', 'would', 'you', 'your',
  'we', 'they', 'their', 'our', 'i', 'he', 'she', 'them', 'his', 'her'
])

const ASCII_TOKEN_REGEX = /[a-z0-9_/.-]{2,}/g
const CJK_SEGMENT_REGEX = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]+/gu

export type DenseDistanceMetric = 'ip' | 'cosine' | 'l2'

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(1, value))
}

function buildTermFrequency(tokens: string[]): Map<string, number> {
  const freq = new Map<string, number>()
  for (const token of tokens) {
    freq.set(token, (freq.get(token) ?? 0) + 1)
  }
  return freq
}

export function normalizeWhitespace(input: string): string {
  return input
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

export function tokenize(input: string): string[] {
  const normalized = input.toLowerCase()
  const asciiTokens = normalized.match(ASCII_TOKEN_REGEX) ?? []
  const cjkSegments = normalized.match(CJK_SEGMENT_REGEX) ?? []
  const cjkTokens: string[] = []

  for (const segment of cjkSegments) {
    const chars = [...segment]
    if (chars.length === 1) {
      cjkTokens.push(chars[0])
      continue
    }
    for (let i = 0; i < chars.length - 1; i++) {
      cjkTokens.push(`${chars[i]}${chars[i + 1]}`)
    }
  }

  return [...asciiTokens, ...cjkTokens].filter((part) => {
    if (part.length >= 2) return !STOPWORDS.has(part)
    return true
  })
}

export function extractTopKeywords(input: string, maxCount: number = 24): string[] {
  const freq = new Map<string, number>()
  for (const token of tokenize(input)) {
    freq.set(token, (freq.get(token) ?? 0) + 1)
  }

  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxCount)
    .map(([token]) => token)
}

export function trimToTokenTarget(input: string, targetTokens: number): string {
  const normalized = normalizeWhitespace(input)
  if (!normalized) return ''

  if (estimateTextTokens(normalized) <= targetTokens) {
    return normalized
  }

  const words = normalized.split(/\s+/)
  let low = 1
  let high = words.length
  let best = words.slice(0, 1).join(' ')

  while (low <= high) {
    const mid = Math.floor((low + high) / 2)
    const candidate = words.slice(0, mid).join(' ')
    const tokens = estimateTextTokens(candidate)
    if (tokens <= targetTokens) {
      best = candidate
      low = mid + 1
    } else {
      high = mid - 1
    }
  }

  return best.trim()
}

export function estimateSimilarity(query: string, content: string): number {
  const queryTokens = tokenize(query)
  if (queryTokens.length === 0) return 0

  const queryFreq = buildTermFrequency(queryTokens)
  const contentFreq = buildTermFrequency(tokenize(content))
  if (contentFreq.size === 0) return 0

  let weightedMatched = 0
  let totalWeight = 0
  for (const [token, qCount] of queryFreq) {
    const weight = 1 + Math.log1p(qCount)
    totalWeight += weight
    const contentCount = contentFreq.get(token) ?? 0
    if (contentCount === 0) continue
    weightedMatched += weight * Math.min(1, contentCount / qCount)
  }

  if (totalWeight === 0) return 0
  const overlapScore = weightedMatched / totalWeight
  const phraseScore = content.toLowerCase().includes(query.toLowerCase().trim()) ? 0.15 : 0
  return clamp01(overlapScore * 0.85 + phraseScore)
}

export function normalizeDenseScore(rawScore: number, metric: DenseDistanceMetric): number {
  if (!Number.isFinite(rawScore)) return 0

  if (metric === 'l2') {
    return clamp01(1 - rawScore)
  }

  if (metric === 'ip') {
    const bounded = rawScore / (Math.abs(rawScore) + 1)
    return clamp01((bounded + 1) / 2)
  }

  // cosine metric
  if (rawScore >= 0 && rawScore <= 1) {
    return rawScore
  }
  return clamp01((rawScore + 1) / 2)
}

export function blendDenseSparseScores(denseScore: number, sparseScore: number, alpha: number): number {
  const safeAlpha = clamp01(alpha)
  const safeDense = clamp01(denseScore)
  const safeSparse = clamp01(sparseScore)
  return clamp01((1 - safeAlpha) * safeDense + safeAlpha * safeSparse)
}

export function estimateDenseSimilarity(
  query: string,
  content: string,
  metric: DenseDistanceMetric = 'cosine'
): number {
  const queryTokens = tokenize(query)
  const contentTokens = tokenize(content)
  if (queryTokens.length === 0 || contentTokens.length === 0) {
    return 0
  }

  const queryFreq = buildTermFrequency(queryTokens)
  const contentFreq = buildTermFrequency(contentTokens)
  const allTokens = new Set([...queryFreq.keys(), ...contentFreq.keys()])

  let dot = 0
  let queryNorm = 0
  let contentNorm = 0
  let l2Distance = 0

  for (const token of allTokens) {
    const q = queryFreq.get(token) ?? 0
    const c = contentFreq.get(token) ?? 0
    dot += q * c
    queryNorm += q * q
    contentNorm += c * c
    const diff = q - c
    l2Distance += diff * diff
  }

  if (metric === 'l2') {
    return normalizeDenseScore(l2Distance, 'l2')
  }

  if (metric === 'ip') {
    return normalizeDenseScore(dot, 'ip')
  }

  const denominator = Math.sqrt(queryNorm) * Math.sqrt(contentNorm)
  if (denominator === 0) return 0
  const cosine = dot / denominator
  return normalizeDenseScore(cosine, 'cosine')
}
