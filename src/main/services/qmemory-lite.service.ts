import {
  qmemoryLiteStorage,
  type QmemoryMessage,
  type MessageCategory,
  type MessageSentiment,
  type QmemoryQueryOptions,
  type QmemoryStats,
} from './qmemory-lite.storage'
import type { IncomingMessageEvent, OutgoingMessageEvent } from './infra.service'

// ==================== Importance Scoring ====================

const IMPORTANCE_PATTERNS = {
  // High importance patterns (identity, core info)
  high: [
    /i am\s+/i,
    /my name is\s+/i,
    /i'm\s+/i,
    /remember that\s+/i,
    /don't forget\s+/i,
    /important\s+/i,
    /critical\s+/i,
    /essential\s+/i,
    /password\s+/i,
    /api key\s+/i,
    /secret\s+/i,
    /token\s+/i,
    /login\s+/i,
    /account\s+/i,
  ],
  // Medium importance patterns (tasks, decisions)
  medium: [
    /i need\s+/i,
    /i want\s+/i,
    /let's\s+/i,
    /we should\s+/i,
    /todo\s+/i,
    /task\s+/i,
    /project\s+/i,
    /deadline\s+/i,
    /meeting\s+/i,
    /schedule\s+/i,
    /code\s+/i,
    /error\s+/i,
    /bug\s+/i,
    /fix\s+/i,
    /implement\s+/i,
  ],
  // Low importance patterns (small talk)
  low: [
    /^hi$/i,
    /^hello$/i,
    /^hey$/i,
    /^ok$/i,
    /^okay$/i,
    /^sure$/i,
    /^yes$/i,
    /^no$/i,
    /^thanks$/i,
    /^thank you$/i,
    /^bye$/i,
    /^goodbye$/i,
    /how are you/i,
    /what's up/i,
    /weather/i,
  ],
}

// Category patterns
const CATEGORY_PATTERNS: Record<MessageCategory, RegExp[]> = {
  identity: [
    /i am\s+/i,
    /my name is\s+/i,
    /i'm\s+/i,
    /i live\s+/i,
    /i work\s+/i,
    /my job\s+/i,
    /my role\s+/i,
    /my position\s+/i,
  ],
  moment: [
    /remember when\s+/i,
    /yesterday\s+/i,
    /last week\s+/i,
    /last month\s+/i,
    /a while ago\s+/i,
    /found\s+/i,
    /discovered\s+/i,
    /learned\s+/i,
    /realized\s+/i,
  ],
  technical: [
    /code\s+/i,
    /error\s+/i,
    /bug\s+/i,
    /fix\s+/i,
    /implement\s+/i,
    /function\s+/i,
    /class\s+/i,
    /variable\s+/i,
    /api\s+/i,
    /database\s+/i,
    /server\s+/i,
    /client\s+/i,
    /config\s+/i,
    /setting\s+/i,
  ],
  task: [
    /todo\s+/i,
    /task\s+/i,
    /need to\s+/i,
    /have to\s+/i,
    /should\s+/i,
    /must\s+/i,
    /deadline\s+/i,
    /schedule\s+/i,
    /meeting\s+/i,
    /appointment\s+/i,
  ],
  chatter: [
    /^hi$/i,
    /^hello$/i,
    /^hey$/i,
    /^ok$/i,
    /^okay$/i,
    /^sure$/i,
    /^yes$/i,
    /^no$/i,
    /^thanks$/i,
    /^thank you$/i,
    /^bye$/i,
    /^goodbye$/i,
    /how are you/i,
    /what's up/i,
    /weather/i,
  ],
  unknown: [],
}

// Sentiment patterns
const SENTIMENT_PATTERNS: Record<MessageSentiment, RegExp[]> = {
  positive: [
    /great/i,
    /awesome/i,
    /amazing/i,
    /excellent/i,
    /wonderful/i,
    /fantastic/i,
    /love/i,
    /like/i,
    /happy/i,
    /excited/i,
    /thank/i,
    /appreciate/i,
    /good/i,
    /nice/i,
    /perfect/i,
  ],
  negative: [
    /bad/i,
    /terrible/i,
    /awful/i,
    /horrible/i,
    /hate/i,
    /dislike/i,
    /sad/i,
    /angry/i,
    /frustrated/i,
    /annoyed/i,
    /sorry/i,
    /apologize/i,
    /error/i,
    /fail/i,
    /problem/i,
  ],
  neutral: [],
  unknown: [],
}

// ==================== Keyword Extraction ====================

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
  'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare', 'ought',
  'used', 'it', 'its', 'this', 'that', 'these', 'those', 'i', 'you', 'he',
  'she', 'we', 'they', 'me', 'him', 'her', 'us', 'them', 'my', 'your', 'his',
  'her', 'its', 'our', 'their', 'mine', 'yours', 'hers', 'ours', 'theirs',
  'what', 'which', 'who', 'whom', 'whose', 'where', 'when', 'why', 'how',
  'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other', 'some',
  'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too',
  'very', 'just', 'now', 'here', 'there', 'then', 'once', 'if', 'else',
])

function extractKeywords(content: string): string[] {
  // Tokenize and clean
  const words = content
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !STOP_WORDS.has(word))

  // Count word frequency
  const wordCounts: Record<string, number> = {}
  for (const word of words) {
    wordCounts[word] = (wordCounts[word] || 0) + 1
  }

  // Sort by frequency and return top keywords
  return Object.entries(wordCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word]) => word)
}

// ==================== Classification Functions ====================

function calculateImportance(content: string): number {
  let score = 0.5 // Base score

  // Check high importance patterns
  for (const pattern of IMPORTANCE_PATTERNS.high) {
    if (pattern.test(content)) {
      score += 0.2
      break
    }
  }

  // Check medium importance patterns
  for (const pattern of IMPORTANCE_PATTERNS.medium) {
    if (pattern.test(content)) {
      score += 0.1
      break
    }
  }

  // Check low importance patterns
  for (const pattern of IMPORTANCE_PATTERNS.low) {
    if (pattern.test(content)) {
      score -= 0.2
      break
    }
  }

  // Length bonus (longer messages tend to be more important)
  if (content.length > 200) score += 0.1
  if (content.length > 500) score += 0.1

  // Code detection bonus
  if (/```|function|const|let|var|import|export|class/.test(content)) {
    score += 0.15
  }

  // Question detection (questions often need answers)
  if (/\?/.test(content)) {
    score += 0.05
  }

  return Math.max(0, Math.min(1, score))
}

function classifyCategory(content: string): MessageCategory {
  const scores: Record<MessageCategory, number> = {
    identity: 0,
    moment: 0,
    technical: 0,
    task: 0,
    chatter: 0,
    unknown: 0,
  }

  // Score each category
  for (const [category, patterns] of Object.entries(CATEGORY_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(content)) {
        scores[category as MessageCategory] += 1
      }
    }
  }

  // Find highest scoring category
  let maxCategory: MessageCategory = 'unknown'
  let maxScore = 0

  for (const [category, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score
      maxCategory = category as MessageCategory
    }
  }

  return maxCategory
}

function classifySentiment(content: string): MessageSentiment {
  const scores: Record<MessageSentiment, number> = {
    positive: 0,
    negative: 0,
    neutral: 0,
    unknown: 0,
  }

  // Score each sentiment
  for (const [sentiment, patterns] of Object.entries(SENTIMENT_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(content)) {
        scores[sentiment as MessageSentiment] += 1
      }
    }
  }

  // Find highest scoring sentiment
  let maxSentiment: MessageSentiment = 'neutral'
  let maxScore = 0

  for (const [sentiment, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score
      maxSentiment = sentiment as MessageSentiment
    }
  }

  return maxSentiment
}

// ==================== Service ====================

class QmemoryLiteService {
  private unsubscribers: (() => void)[] = []

  async start(): Promise<boolean> {
    await qmemoryLiteStorage.initialize()
    console.log('[QmemoryLite] Service started')
    return true
  }

  stop(): void {
    this.unsubscribers.forEach((unsub) => unsub())
    this.unsubscribers = []
    console.log('[QmemoryLite] Service stopped')
  }

  // ==================== Message Processing ====================

  async processMessage(
    event: IncomingMessageEvent | OutgoingMessageEvent,
    direction: 'incoming' | 'outgoing'
  ): Promise<QmemoryMessage> {
    const content =
      typeof event.message.content === 'string'
        ? event.message.content
        : JSON.stringify(event.message.content)

    // Calculate all metadata
    const importance = calculateImportance(content)
    const category = classifyCategory(content)
    const sentiment = classifySentiment(content)
    const keywords = extractKeywords(content)

    // Store the message
    const message = await qmemoryLiteStorage.addMessage({
      platform: event.platform,
      role: event.message.role,
      content,
      timestamp: event.timestamp,
      importance,
      category,
      sentiment,
      keywords,
    })

    console.log(
      `[QmemoryLite] Processed message: importance=${importance.toFixed(2)}, category=${category}, sentiment=${sentiment}`
    )

    return message
  }

  // ==================== Query API ====================

  async query(options: QmemoryQueryOptions): Promise<QmemoryMessage[]> {
    return qmemoryLiteStorage.query(options)
  }

  async getRecentMessages(days: number = 7, limit: number = 100): Promise<QmemoryMessage[]> {
    return qmemoryLiteStorage.getRecentMessages(days, limit)
  }

  async getMessagesByPlatform(platform: string, limit: number = 100): Promise<QmemoryMessage[]> {
    return qmemoryLiteStorage.getMessagesByPlatform(platform, limit)
  }

  async getHighImportanceMessages(limit: number = 50): Promise<QmemoryMessage[]> {
    return qmemoryLiteStorage.getHighImportanceMessages(limit)
  }

  async searchMessages(query: string, limit: number = 50): Promise<QmemoryMessage[]> {
    return qmemoryLiteStorage.searchMessages(query, limit)
  }

  async getStats(): Promise<QmemoryStats> {
    return qmemoryLiteStorage.getStats()
  }

  async getMessage(id: string): Promise<QmemoryMessage | null> {
    return qmemoryLiteStorage.getMessage(id)
  }

  async deleteMessage(id: string): Promise<boolean> {
    return qmemoryLiteStorage.deleteMessage(id)
  }

  async clearAll(): Promise<void> {
    return qmemoryLiteStorage.clearAll()
  }

  // ==================== Utility Functions ====================

  /**
   * Get a summary of recent conversations for context
   */
  async getContextSummary(days: number = 7): Promise<string> {
    const messages = await this.getRecentMessages(days, 50)
    const highImportance = messages.filter(m => m.importance >= 0.7)
    
    if (highImportance.length === 0) {
      return 'No significant conversations in the recent period.'
    }

    const summary = highImportance
      .map(m => `[${m.platform}] ${m.role}: ${m.content.slice(0, 100)}...`)
      .join('\n')

    return `Recent important conversations:\n${summary}`
  }

  /**
   * Find related messages based on keywords
   */
  async findRelated(messageId: string, limit: number = 5): Promise<QmemoryMessage[]> {
    const message = await this.getMessage(messageId)
    if (!message) return []

    const related: QmemoryMessage[] = []
    
    for (const keyword of message.keywords) {
      const found = await this.searchMessages(keyword, limit)
      for (const msg of found) {
        if (msg.id !== messageId && !related.find(r => r.id === msg.id)) {
          related.push(msg)
        }
      }
    }

    return related.slice(0, limit)
  }
}

export const qmemoryLiteService = new QmemoryLiteService()
