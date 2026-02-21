import fs from 'node:fs/promises'
import type Anthropic from '@anthropic-ai/sdk'
import type {
  ContextEvalCase,
  ContextEvalCaseLabels,
  ContextEvalCaseMessage,
  NormalizedContextEvalCase
} from './types'

const LAYER_VALUES = new Set(['L0', 'L1', 'L2'])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizeStringArray(input: unknown): string[] {
  if (!Array.isArray(input)) return []
  const values = input
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter((item) => item.length > 0)
  return Array.from(new Set(values))
}

function normalizeLabels(input: unknown): ContextEvalCaseLabels {
  if (!isRecord(input)) return {}

  const expectedEvidence = normalizeStringArray(input.expectedEvidence)
  const tags = normalizeStringArray(input.tags)
  const expectedLayerMinRaw = typeof input.expectedLayerMin === 'string' ? input.expectedLayerMin.trim() : ''
  const expectedLayerMin = LAYER_VALUES.has(expectedLayerMinRaw) ? expectedLayerMinRaw : undefined
  const referenceAnswer = typeof input.referenceAnswer === 'string' ? input.referenceAnswer.trim() : undefined

  return {
    expectedEvidence: expectedEvidence.length > 0 ? expectedEvidence : undefined,
    expectedLayerMin,
    referenceAnswer: referenceAnswer && referenceAnswer.length > 0 ? referenceAnswer : undefined,
    tags: tags.length > 0 ? tags : undefined
  }
}

function normalizeMessages(input: unknown, caseId: string): ContextEvalCaseMessage[] {
  if (!Array.isArray(input) || input.length === 0) {
    throw new Error(`Case "${caseId}" must define a non-empty "messages" array.`)
  }

  const messages: ContextEvalCaseMessage[] = []
  for (const [index, rawMessage] of input.entries()) {
    if (!isRecord(rawMessage)) {
      throw new Error(`Case "${caseId}" message at index ${index} must be an object.`)
    }

    const role = typeof rawMessage.role === 'string' ? rawMessage.role.trim() : ''
    if (role !== 'user' && role !== 'assistant') {
      throw new Error(`Case "${caseId}" message at index ${index} has invalid role "${String(rawMessage.role)}".`)
    }

    const content = typeof rawMessage.content === 'string' ? rawMessage.content.trim() : ''
    if (!content) {
      throw new Error(`Case "${caseId}" message at index ${index} must have non-empty string content.`)
    }

    messages.push({ role, content })
  }

  return messages
}

function normalizeCase(raw: unknown, lineNumber: number): NormalizedContextEvalCase {
  if (!isRecord(raw)) {
    throw new Error(`Invalid JSON object at line ${lineNumber}.`)
  }

  const id = typeof raw.id === 'string' ? raw.id.trim() : ''
  if (!id) {
    throw new Error(`Case at line ${lineNumber} is missing a valid "id".`)
  }

  const query = typeof raw.query === 'string' ? raw.query.trim() : ''
  if (!query) {
    throw new Error(`Case "${id}" is missing a valid "query".`)
  }

  const messages = normalizeMessages(raw.messages, id)
  const labels = normalizeLabels(raw.labels)
  const platform = typeof raw.platform === 'string' && raw.platform.trim() ? raw.platform.trim() : 'telegram'
  const chatId = typeof raw.chatId === 'string' ? raw.chatId.trim() : null
  const metadata = isRecord(raw.metadata) ? raw.metadata : undefined

  return {
    id,
    query,
    messages: toAnthropicMessages(messages),
    platform,
    chatId,
    labels,
    metadata
  }
}

export function toAnthropicMessages(messages: ContextEvalCaseMessage[]): Anthropic.MessageParam[] {
  return messages.map((message) => ({
    role: message.role,
    content: message.content
  }))
}

export function ensureTrailingUserQuery(
  messages: Anthropic.MessageParam[],
  query: string
): Anthropic.MessageParam[] {
  if (messages.length === 0) {
    return [{ role: 'user', content: query }]
  }

  const tail = messages[messages.length - 1]
  if (tail.role === 'user') {
    if (typeof tail.content === 'string' && tail.content.trim().length > 0) {
      return messages
    }
  }

  return [...messages, { role: 'user', content: query }]
}

export async function loadDataset(datasetPath: string): Promise<NormalizedContextEvalCase[]> {
  const raw = await fs.readFile(datasetPath, 'utf-8')
  const lines = raw.split(/\r?\n/)
  const cases: NormalizedContextEvalCase[] = []
  const seenIds = new Set<string>()

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line || line.startsWith('#')) continue

    let parsed: ContextEvalCase
    try {
      parsed = JSON.parse(line) as ContextEvalCase
    } catch (error) {
      throw new Error(`Failed to parse JSON at line ${i + 1}: ${error instanceof Error ? error.message : String(error)}`)
    }

    const normalized = normalizeCase(parsed, i + 1)
    if (seenIds.has(normalized.id)) {
      throw new Error(`Duplicate case id "${normalized.id}" found at line ${i + 1}.`)
    }

    seenIds.add(normalized.id)
    cases.push(normalized)
  }

  if (cases.length === 0) {
    throw new Error('Dataset is empty. Add at least one JSONL case.')
  }

  return cases
}

