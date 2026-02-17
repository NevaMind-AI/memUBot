import { estimateTextTokens } from '../token-estimator'

const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'to', 'for', 'of', 'in', 'on', 'at', 'is', 'are',
  'was', 'were', 'be', 'been', 'this', 'that', 'it', 'as', 'with', 'by', 'from',
  'about', 'into', 'through', 'can', 'could', 'should', 'would', 'you', 'your',
  'we', 'they', 'their', 'our', 'i', 'he', 'she', 'them', 'his', 'her'
])

const ASCII_TOKEN_REGEX = /[a-z0-9_/.-]{2,}/g
const CJK_SEGMENT_REGEX = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]+/gu
const BM25_K1 = 1.2
const BM25_B = 0.75
const PHRASE_BONUS = 0.15

export type DenseDistanceMetric = 'ip' | 'cosine' | 'l2'

export interface Bm25Document {
  id: string
  content: string
}

interface Bm25DocStats {
  length: number
  termFreq: Map<string, number>
  normalizedContent: string
}

export interface Bm25Model {
  documentCount: number
  avgDocumentLength: number
  docFreq: Map<string, number>
  docs: Map<string, Bm25DocStats>
  k1: number
  b: number
}

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

function normalizeBm25Score(rawScore: number): number {
  if (!Number.isFinite(rawScore) || rawScore <= 0) return 0
  return clamp01(1 - Math.exp(-rawScore))
}

function calcBm25Idf(documentCount: number, docFrequency: number): number {
  return Math.log(1 + (documentCount - docFrequency + 0.5) / (docFrequency + 0.5))
}

function calcPhraseBonus(query: string, normalizedContent: string): number {
  const normalizedQuery = normalizeWhitespace(query).toLowerCase()
  if (!normalizedQuery) return 0
  return normalizedContent.includes(normalizedQuery) ? PHRASE_BONUS : 0
}

function scoreDocumentWithBm25(
  model: Bm25Model,
  query: string,
  queryTokens: string[],
  queryFreq: Map<string, number>,
  docStats: Bm25DocStats
): number {
  if (queryTokens.length === 0 || docStats.length === 0) return 0

  let rawScore = 0
  const lengthNorm = 1 - model.b + model.b * (docStats.length / Math.max(1, model.avgDocumentLength))
  for (const [token, qCount] of queryFreq) {
    const tf = docStats.termFreq.get(token) ?? 0
    if (tf <= 0) continue
    const df = model.docFreq.get(token) ?? 0
    if (df <= 0) continue
    const idf = calcBm25Idf(model.documentCount, df)
    const tfNorm = (tf * (model.k1 + 1)) / (tf + model.k1 * lengthNorm)
    const queryWeight = 1 + Math.log1p(qCount)
    rawScore += idf * tfNorm * queryWeight
  }

  const bm25Score = normalizeBm25Score(rawScore)
  const phraseBonus = calcPhraseBonus(query, docStats.normalizedContent)
  return clamp01(bm25Score + phraseBonus)
}

export function buildBm25Model(
  documents: Bm25Document[],
  options?: {
    k1?: number
    b?: number
  }
): Bm25Model {
  const k1 = options?.k1 ?? BM25_K1
  const b = options?.b ?? BM25_B
  const docs = new Map<string, Bm25DocStats>()
  const docFreq = new Map<string, number>()
  let totalLength = 0

  for (const document of documents) {
    const tokens = tokenize(document.content)
    const termFreq = buildTermFrequency(tokens)
    const length = tokens.length
    totalLength += length
    docs.set(document.id, {
      length,
      termFreq,
      normalizedContent: normalizeWhitespace(document.content).toLowerCase()
    })

    const uniqueTokens = new Set(termFreq.keys())
    for (const token of uniqueTokens) {
      docFreq.set(token, (docFreq.get(token) ?? 0) + 1)
    }
  }

  return {
    documentCount: documents.length,
    avgDocumentLength: documents.length > 0 ? totalLength / documents.length : 0,
    docFreq,
    docs,
    k1,
    b
  }
}

export function scoreBm25Batch(model: Bm25Model, query: string): Map<string, number> {
  const queryTokens = tokenize(query)
  const queryFreq = buildTermFrequency(queryTokens)
  const scores = new Map<string, number>()
  for (const [docId, docStats] of model.docs) {
    scores.set(docId, scoreDocumentWithBm25(model, query, queryTokens, queryFreq, docStats))
  }
  return scores
}

export function scoreBm25ById(model: Bm25Model, query: string, docId: string): number {
  const docStats = model.docs.get(docId)
  if (!docStats) return 0
  const queryTokens = tokenize(query)
  const queryFreq = buildTermFrequency(queryTokens)
  return scoreDocumentWithBm25(model, query, queryTokens, queryFreq, docStats)
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
  const model = buildBm25Model([{ id: 'doc', content }])
  return scoreBm25ById(model, query, 'doc')
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
