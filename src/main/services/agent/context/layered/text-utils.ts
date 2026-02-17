import { estimateTextTokens } from '../token-estimator'

const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'to', 'for', 'of', 'in', 'on', 'at', 'is', 'are',
  'was', 'were', 'be', 'been', 'this', 'that', 'it', 'as', 'with', 'by', 'from',
  'about', 'into', 'through', 'can', 'could', 'should', 'would', 'you', 'your',
  'we', 'they', 'their', 'our', 'i', 'he', 'she', 'them', 'his', 'her'
])

export function normalizeWhitespace(input: string): string {
  return input
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

export function tokenize(input: string): string[] {
  const normalized = input.toLowerCase()
  const parts = normalized.split(/[^a-z0-9_/.-]+/g)
  return parts
    .map((part) => part.trim())
    .filter((part) => part.length >= 2 && !STOPWORDS.has(part))
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

  const contentTokens = new Set(tokenize(content))
  let matched = 0
  for (const token of queryTokens) {
    if (contentTokens.has(token)) {
      matched++
    }
  }

  const overlapScore = matched / queryTokens.length
  const phraseScore = content.toLowerCase().includes(query.toLowerCase().trim()) ? 0.15 : 0
  return Math.min(1, overlapScore + phraseScore)
}
