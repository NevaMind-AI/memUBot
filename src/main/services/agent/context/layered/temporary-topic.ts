import Anthropic from '@anthropic-ai/sdk'
import { normalizeWhitespace } from './text-utils'
import { DEFAULT_BASE_URL } from '../../../api/client'

// ============================================
// Types
// ============================================

export interface TemporaryTopicThresholds {
  enterThreshold: number
  exitThreshold: number
  tempStayThreshold: number
}

export const DEFAULT_TEMPORARY_TOPIC_THRESHOLDS: TemporaryTopicThresholds = {
  enterThreshold: 0.55,
  exitThreshold: 0.55,
  tempStayThreshold: 0.8
}

export type TemporaryTopicMode = 'MAIN' | 'TEMP'

export type TemporaryTopicDecision =
  | 'stay-main'
  | 'enter-temp'
  | 'stay-temp'
  | 'replace-temp'
  | 'exit-temp'

export interface TemporaryTopicTransitionInput {
  mode: TemporaryTopicMode
  query: string
  mainTopicReference: string
  tempTopicReference?: string
  thresholds?: TemporaryTopicThresholds
}

export interface TemporaryTopicTransition {
  decision: TemporaryTopicDecision
  relMain: number
  relTemp: number
}

// ============================================
// Topic Scorer Abstraction
// ============================================

export interface TopicRelevanceScores {
  relMain: number
  relTemp: number
}

export type TopicScorer = (
  query: string,
  mainTopicReference: string,
  tempTopicReference: string
) => Promise<TopicRelevanceScores>

// ============================================
// LLM Topic Scorer
// ============================================

const NONMEMORIZE_BASE_URL = `${DEFAULT_BASE_URL}/api/v3/yumi/anthropic/nonmemorize`
const DEFAULT_SCORER_MODEL = 'agile'
const SCORER_MAX_TOKENS = 2048

const SCORER_SYSTEM_PROMPT =
  'Rate query relevance to each topic (0.0=unrelated, 1.0=same topic). ' +
  'If a topic is absent, its score is 0. Reply with ONLY: {"relMain":<n>,"relTemp":<n>}'

function buildScoringPrompt(
  query: string,
  mainTopicReference: string,
  tempTopicReference: string
): string {
  let prompt = `Main topic: ${mainTopicReference || '(none)'}`
  if (tempTopicReference) prompt += `\nTemp topic: ${tempTopicReference}`
  prompt += `\nQuery: ${query}`
  return prompt
}

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(1, value))
}

function parseRelevanceScores(text: string): TopicRelevanceScores {
  try {
    const jsonMatch = text.match(/\{[^}]*\}/)
    if (!jsonMatch) return { relMain: 0, relTemp: 0 }

    const parsed = JSON.parse(jsonMatch[0])
    return {
      relMain: typeof parsed.relMain === 'number' ? clampScore(parsed.relMain) : 0,
      relTemp: typeof parsed.relTemp === 'number' ? clampScore(parsed.relTemp) : 0
    }
  } catch {
    return { relMain: 0, relTemp: 0 }
  }
}

export interface LLMTopicScorerOptions {
  apiKey: string
  model?: string
  maxTokens?: number
}

export function createLLMTopicScorer(options: LLMTopicScorerOptions): TopicScorer {
  const client = new Anthropic({
    authToken: options.apiKey,
    baseURL: NONMEMORIZE_BASE_URL
  })
  const resolvedModel = options.model ?? DEFAULT_SCORER_MODEL
  const resolvedMaxTokens = options.maxTokens ?? SCORER_MAX_TOKENS

  return async (query, mainTopicReference, tempTopicReference) => {
    if (!query) return { relMain: 0, relTemp: 0 }
    if (!mainTopicReference && !tempTopicReference) return { relMain: 0, relTemp: 0 }

    try {
      const response = await client.messages.create({
        model: resolvedModel,
        max_tokens: resolvedMaxTokens,
        system: SCORER_SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: buildScoringPrompt(query, mainTopicReference, tempTopicReference)
          }
        ]
      })

      const text = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('')
      return parseRelevanceScores(text)
    } catch (error) {
      console.error('[TemporaryTopic] LLM scoring failed:', error)
      return { relMain: 1, relTemp: 1 }
    }
  }
}

// ============================================
// LLM Topic Classifier (direct decision, no scoring)
// ============================================

const CLASSIFIER_SYSTEM_PROMPT =
  'Classify the query\'s relationship to conversation topics. ' +
  'Reply with ONLY one label, no explanation.'

const MAIN_MODE_LABELS = 'stay-main (query continues main topic) or enter-temp (query departs to a new topic)'
const TEMP_MODE_LABELS =
  'stay-temp (query continues temp topic), ' +
  'exit-temp (query returns to main topic), or ' +
  'replace-temp (query starts yet another unrelated topic)'

const VALID_DECISIONS = new Set<TemporaryTopicDecision>([
  'stay-main', 'enter-temp', 'stay-temp', 'replace-temp', 'exit-temp'
])

function buildClassificationPrompt(
  query: string,
  mainTopicReference: string,
  tempTopicReference: string
): string {
  const hasTemp = !!tempTopicReference
  let prompt = `Main topic: ${mainTopicReference || '(none)'}`
  if (hasTemp) prompt += `\nTemp topic: ${tempTopicReference}`
  prompt += `\nQuery: ${query}`
  prompt += `\nLabel: ${hasTemp ? TEMP_MODE_LABELS : MAIN_MODE_LABELS}`
  return prompt
}

function parseClassification(
  text: string,
  hasTemp: boolean
): TopicRelevanceScores {
  const normalized = text.trim().toLowerCase()
  let decision: TemporaryTopicDecision | null = null

  for (const d of VALID_DECISIONS) {
    if (normalized.includes(d)) {
      decision = d
      break
    }
  }

  if (!decision) {
    return hasTemp ? { relMain: 0, relTemp: 1 } : { relMain: 1, relTemp: 0 }
  }

  return classificationToScores(decision)
}

function classificationToScores(decision: TemporaryTopicDecision): TopicRelevanceScores {
  switch (decision) {
    case 'stay-main':
      return { relMain: 1, relTemp: 0 }
    case 'enter-temp':
      return { relMain: 0, relTemp: 0 }
    case 'stay-temp':
      return { relMain: 0, relTemp: 1 }
    case 'exit-temp':
      return { relMain: 1, relTemp: 0 }
    case 'replace-temp':
      return { relMain: 0, relTemp: 0 }
  }
}

export function createLLMTopicClassifier(options: LLMTopicScorerOptions): TopicScorer {
  const client = new Anthropic({
    authToken: options.apiKey,
    baseURL: NONMEMORIZE_BASE_URL
  })
  const resolvedModel = options.model ?? DEFAULT_SCORER_MODEL
  const resolvedMaxTokens = options.maxTokens ?? SCORER_MAX_TOKENS

  return async (query, mainTopicReference, tempTopicReference) => {
    if (!query) return { relMain: 0, relTemp: 0 }
    if (!mainTopicReference && !tempTopicReference) return { relMain: 0, relTemp: 0 }

    const hasTemp = !!tempTopicReference

    try {
      const response = await client.messages.create({
        model: resolvedModel,
        max_tokens: resolvedMaxTokens,
        system: CLASSIFIER_SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: buildClassificationPrompt(query, mainTopicReference, tempTopicReference)
          }
        ]
      })

      const text = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('')
      return parseClassification(text, hasTemp)
    } catch (error) {
      console.error('[TemporaryTopic] LLM classification failed:', error)
      return { relMain: 1, relTemp: 1 }
    }
  }
}

// ============================================
// Topic Reference Builder
// ============================================

const TOPIC_REFERENCE_MAX_MESSAGES = 8
const TOPIC_REFERENCE_MAX_CHARS_PER_MESSAGE = 120
const TOPIC_REFERENCE_MAX_TOTAL_CHARS = 600

function clipText(input: string, maxChars: number): string {
  if (input.length <= maxChars) return input
  return `${input.slice(0, maxChars)}...`
}

function extractTextFromContent(content: Anthropic.MessageParam['content']): string {
  if (typeof content === 'string') {
    return normalizeWhitespace(content)
  }

  if (!Array.isArray(content)) {
    return ''
  }

  const textBlocks: string[] = []
  for (const block of content) {
    if (block.type === 'text' && typeof block.text === 'string') {
      textBlocks.push(block.text)
    }
  }

  return normalizeWhitespace(textBlocks.join('\n'))
}

export function buildTopicReference(
  messages: Anthropic.MessageParam[],
  maxMessages: number = TOPIC_REFERENCE_MAX_MESSAGES
): string {
  if (messages.length === 0) return ''

  const sliceStart = Math.max(0, messages.length - maxMessages)
  const recentMessages = messages.slice(sliceStart)
  const lines: string[] = []

  for (const message of recentMessages) {
    const text = extractTextFromContent(message.content)
    if (!text) continue
    lines.push(clipText(text, TOPIC_REFERENCE_MAX_CHARS_PER_MESSAGE))
  }

  const joined = lines.join('; ')
  return clipText(normalizeWhitespace(joined), TOPIC_REFERENCE_MAX_TOTAL_CHARS)
}

// ============================================
// Decision Logic
// ============================================

export async function decideTemporaryTopicTransition(
  input: TemporaryTopicTransitionInput,
  scorer: TopicScorer
): Promise<TemporaryTopicTransition> {
  const thresholds = input.thresholds ?? DEFAULT_TEMPORARY_TOPIC_THRESHOLDS
  const query = normalizeWhitespace(input.query)
  const mainTopicReference = normalizeWhitespace(input.mainTopicReference)
  const tempTopicReference = normalizeWhitespace(input.tempTopicReference ?? '')

  const { relMain, relTemp } = await scorer(query, mainTopicReference, tempTopicReference)

  if (input.mode === 'MAIN') {
    if (!query || !mainTopicReference) {
      return { decision: 'stay-main', relMain, relTemp: 0 }
    }

    if (relMain < thresholds.enterThreshold) {
      return { decision: 'enter-temp', relMain, relTemp: 0 }
    }

    return { decision: 'stay-main', relMain, relTemp: 0 }
  }

  if (!query) {
    return { decision: 'stay-temp', relMain, relTemp }
  }

  if (mainTopicReference && relMain > thresholds.exitThreshold && relTemp < thresholds.tempStayThreshold) {
    return { decision: 'exit-temp', relMain, relTemp }
  }

  if (relMain < thresholds.enterThreshold && relTemp < thresholds.tempStayThreshold) {
    return { decision: 'replace-temp', relMain, relTemp }
  }

  return { decision: 'stay-temp', relMain, relTemp }
}
