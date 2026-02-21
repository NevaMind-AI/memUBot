import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { extractTopKeywords, tokenize } from '../../src/main/services/agent/context/layered/text-utils'
import type { ContextLayer } from '../../src/main/services/agent/context/layered/types'
import type { ContextEvalCase, ContextEvalCaseMessage } from './types'

type SupportedPlatform = 'telegram' | 'discord' | 'slack' | 'feishu' | 'yumi'

interface RawConversationMessage {
  platform: SupportedPlatform
  chatId: string
  date: number
  text: string
  isFromBot: boolean
  sourceMessageId: string
}

interface BuildOptions {
  userDataDir: string
  outputPath: string
  targetCases: number
  maxCasesPerConversation: number
  strictConversationCap: boolean
  variantsPerQuery: number
  minHistoryMessages: number
  minWindowMessages: number
  maxWindowMessages: number
  minQueryChars: number
  seed: number
  redact: boolean
  platforms: SupportedPlatform[]
}

interface CandidateCase {
  baseId: string
  platform: SupportedPlatform
  chatId: string
  expectedLayerMin: ContextLayer
  query: string
  messages: ContextEvalCaseMessage[]
  labels: {
    expectedEvidence: string[]
    expectedLayerMin: ContextLayer
    tags: string[]
  }
  metadata: Record<string, unknown>
}

const PLATFORM_STORAGE_FILE: Record<SupportedPlatform, string> = {
  telegram: 'telegram-data/messages.json',
  discord: 'discord-data/messages.json',
  slack: 'slack-data/messages.json',
  feishu: 'feishu-data/messages.json',
  yumi: 'yumi-data/messages.json'
}

function parseArgs(argv: string[]): Map<string, string> {
  const args = new Map<string, string>()
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i]
    if (!token.startsWith('--')) continue
    const key = token.slice(2)
    const next = argv[i + 1]
    if (!next || next.startsWith('--')) {
      args.set(key, 'true')
      continue
    }
    args.set(key, next)
    i++
  }
  return args
}

function parseInteger(value: string | undefined, fallback: number): number {
  if (!value) return fallback
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed)) return fallback
  return parsed
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (!value) return fallback
  if (value === '1' || value.toLowerCase() === 'true') return true
  if (value === '0' || value.toLowerCase() === 'false') return false
  return fallback
}

function parsePlatforms(value: string | undefined): SupportedPlatform[] {
  const allowed = new Set<SupportedPlatform>(['telegram', 'discord', 'slack', 'feishu', 'yumi'])
  if (!value) return ['telegram', 'discord', 'slack', 'feishu', 'yumi']
  const parsed = value
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter((item): item is SupportedPlatform => allowed.has(item as SupportedPlatform))
  return parsed.length > 0 ? parsed : ['telegram', 'discord', 'slack', 'feishu', 'yumi']
}

function resolvePath(input: string): string {
  if (input.startsWith('~/')) {
    return path.join(os.homedir(), input.slice(2))
  }
  if (path.isAbsolute(input)) return input
  return path.resolve(process.cwd(), input)
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath)
    return true
  } catch {
    return false
  }
}

function createSeededRng(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let value = Math.imul(state ^ (state >>> 15), 1 | state)
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

function shuffleInPlace<T>(array: T[], rng: () => number): void {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const tmp = array[i]
    array[i] = array[j]
    array[j] = tmp
  }
}

function normalizeWhitespace(input: string): string {
  return input.replace(/\r\n/g, '\n').replace(/\s+/g, ' ').trim()
}

function redactSensitive(text: string): string {
  return text
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '<EMAIL>')
    .replace(/https?:\/\/\S+/gi, '<URL>')
    .replace(/\b(?:\+?\d[\d\s-]{7,}\d)\b/g, '<PHONE>')
    .replace(/\b(?:password|passwd|pwd)\s*[:=]\s*[^\s,;]+/gi, 'password=<SECRET>')
    .replace(/(?:密码|口令)\s*(?:是|为|[:：])\s*[A-Za-z0-9._!@#$%^&*+=-]+/g, '密码=<SECRET>')
    .replace(/\b(?:sk|pk|api|token|secret)[_-]?[a-z0-9_-]{12,}\b/gi, '<SECRET_TOKEN>')
    .replace(/\b\d{6,}\b/g, '<LONG_NUM>')
    .replace(/@[a-zA-Z0-9_]{2,}/g, '<MENTION>')
}

function normalizeContent(input: unknown, redact: boolean): string {
  const raw = typeof input === 'string' ? input : ''
  let text = normalizeWhitespace(raw)
  if (!text) return ''
  if (redact) {
    text = redactSensitive(text)
  }
  const maxChars = 2800
  if (text.length > maxChars) {
    return `${text.slice(0, maxChars)} ...`
  }
  return text
}

function detectExpectedLayer(query: string): ContextLayer {
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
    '.ts',
    '.js',
    '.json',
    '/',
    '具体',
    '报错',
    '错误',
    '参数'
  ]
  if (preciseSignals.some((signal) => normalized.includes(signal))) {
    return 'L2'
  }

  const structuredSignals = ['overview', 'summary', 'architecture', 'flow', 'design', 'scope', 'roadmap', '总结', '架构', '流程']
  if (structuredSignals.some((signal) => normalized.includes(signal))) {
    return 'L1'
  }

  return 'L0'
}

function sanitizeForId(input: string): string {
  return input.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40)
}

function getSpecialEvidenceCandidates(input: string): string[] {
  const matches = input.match(/[A-Za-z0-9._/-]+\.(?:ts|js|json|md|py|java|go|sh)|\b\d{2,}\b|<URL>/g) ?? []
  const unique: string[] = []
  for (const item of matches) {
    if (!unique.includes(item)) unique.push(item)
    if (unique.length >= 3) break
  }
  return unique
}

function buildExpectedEvidence(contextText: string, queryText: string): string[] {
  const queryTokenSet = new Set(tokenize(queryText))
  const evidence: string[] = []

  for (const item of getSpecialEvidenceCandidates(contextText)) {
    if (!evidence.includes(item)) {
      evidence.push(item)
    }
  }

  const contextKeywords = extractTopKeywords(contextText, 28)
  for (const keyword of contextKeywords) {
    if (queryTokenSet.has(keyword)) continue
    if (keyword.length < 2) continue
    if (!evidence.includes(keyword)) {
      evidence.push(keyword)
    }
    if (evidence.length >= 4) break
  }

  if (evidence.length === 0) {
    const fallback = extractTopKeywords(queryText, 3).filter((token) => token.length >= 2)
    return fallback.slice(0, 3)
  }

  return evidence.slice(0, 4)
}

function parseMessageId(raw: Record<string, unknown>): string {
  const value = raw.messageId
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value)
  }
  return 'unknown'
}

function parseDate(raw: Record<string, unknown>): number | null {
  const value = raw.date
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10)
    if (Number.isFinite(parsed)) return parsed
  }
  const timestamp = raw.timestamp
  if (typeof timestamp === 'number' && Number.isFinite(timestamp)) {
    return timestamp
  }
  if (typeof timestamp === 'string') {
    const parsed = Number.parseInt(timestamp, 10)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

function parseChatId(platform: SupportedPlatform, raw: Record<string, unknown>): string | null {
  const candidate =
    platform === 'telegram'
      ? raw.chatId
      : platform === 'discord'
        ? raw.channelId
        : platform === 'slack'
          ? raw.channelId
          : raw.chatId
  if (typeof candidate === 'string' || typeof candidate === 'number') {
    return String(candidate)
  }
  return null
}

function parseText(raw: Record<string, unknown>, redact: boolean): string {
  const preferredText = typeof raw.text === 'string' ? raw.text : raw.content
  const text = normalizeContent(preferredText, redact)
  if (text) return text
  const attachments = Array.isArray(raw.attachments) ? raw.attachments.length : 0
  if (attachments > 0) {
    return `[Attachment x${attachments}]`
  }
  return ''
}

function parseIsFromBot(raw: Record<string, unknown>): boolean {
  return raw.isFromBot === true
}

function toRawConversationMessage(
  platform: SupportedPlatform,
  raw: unknown,
  redact: boolean
): RawConversationMessage | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return null
  }

  const record = raw as Record<string, unknown>
  const chatId = parseChatId(platform, record)
  const date = parseDate(record)
  const text = parseText(record, redact)
  if (!chatId || date === null || !text) {
    return null
  }

  return {
    platform,
    chatId,
    date,
    text,
    isFromBot: parseIsFromBot(record),
    sourceMessageId: parseMessageId(record)
  }
}

async function loadPlatformMessages(
  userDataDir: string,
  platform: SupportedPlatform,
  redact: boolean
): Promise<RawConversationMessage[]> {
  const candidateRoots = [
    userDataDir,
    path.join(os.homedir(), 'Library/Application Support/memu-bot'),
    path.join(os.homedir(), 'Library/Application Support/yumi')
  ]
  const candidatePaths = Array.from(
    new Set(candidateRoots.map((rootDir) => path.join(rootDir, PLATFORM_STORAGE_FILE[platform])))
  )

  let filePath: string | null = null
  for (const candidate of candidatePaths) {
    if (await pathExists(candidate)) {
      filePath = candidate
      break
    }
  }

  if (!filePath) {
    return []
  }

  const content = await fs.readFile(filePath, 'utf-8')
  const parsed = JSON.parse(content) as unknown
  if (!Array.isArray(parsed)) {
    return []
  }

  return parsed
    .map((item) => toRawConversationMessage(platform, item, redact))
    .filter((item): item is RawConversationMessage => item !== null)
    .sort((a, b) => a.date - b.date)
}

function groupByConversation(messages: RawConversationMessage[]): Map<string, RawConversationMessage[]> {
  const groups = new Map<string, RawConversationMessage[]>()
  for (const message of messages) {
    const key = `${message.platform}:${message.chatId}`
    const existing = groups.get(key) ?? []
    existing.push(message)
    groups.set(key, existing)
  }
  for (const group of groups.values()) {
    group.sort((a, b) => a.date - b.date)
  }
  return groups
}

function chooseWindowSize(options: BuildOptions, rng: () => number): number {
  const min = Math.max(2, options.minWindowMessages)
  const max = Math.max(min, options.maxWindowMessages)
  if (max === min) return min
  return min + Math.floor(rng() * (max - min + 1))
}

function buildCandidateCasesForConversation(
  conversationKey: string,
  messages: RawConversationMessage[],
  options: BuildOptions,
  rng: () => number
): CandidateCase[] {
  const [platform, chatId] = conversationKey.split(':')
  const candidates: CandidateCase[] = []
  const normalizedQueryDedup = new Map<string, number>()

  for (let i = 0; i < messages.length; i++) {
    const anchor = messages[i]
    if (anchor.isFromBot) continue
    if (anchor.text.length < options.minQueryChars) continue
    if (i < options.minHistoryMessages) continue

    const normalizedQuery = anchor.text.toLowerCase()
    const dedupCount = normalizedQueryDedup.get(normalizedQuery) ?? 0
    if (dedupCount >= options.variantsPerQuery) continue
    normalizedQueryDedup.set(normalizedQuery, dedupCount + 1)

    const query = anchor.text
    const usedStarts = new Set<number>()

    for (let variantIndex = 0; variantIndex < options.variantsPerQuery; variantIndex++) {
      const windowSize = chooseWindowSize(options, rng)
      const start = Math.max(0, i - windowSize + 1)
      if (usedStarts.has(start)) continue
      usedStarts.add(start)

      const slice = messages.slice(start, i + 1)
      if (slice.length < options.minWindowMessages) continue

      const userMessages = slice.filter((item) => !item.isFromBot).length
      const assistantMessages = slice.filter((item) => item.isFromBot).length
      if (userMessages < 4 || assistantMessages < 3) continue

      const messagesForCase: ContextEvalCaseMessage[] = slice.map((item) => ({
        role: item.isFromBot ? 'assistant' : 'user',
        content: item.text
      }))

      const contextBeforeQuery = slice
        .slice(Math.max(0, slice.length - 7), slice.length - 1)
        .map((item) => item.text)
        .join('\n')
      const expectedLayerMin = detectExpectedLayer(query)
      const expectedEvidence = buildExpectedEvidence(contextBeforeQuery, query)
      const safeChatId = sanitizeForId(chatId)
      const baseId = `v1-${platform}-${safeChatId}-${String(i).padStart(6, '0')}-v${variantIndex + 1}`

      candidates.push({
        baseId,
        platform: platform as SupportedPlatform,
        chatId,
        expectedLayerMin,
        query,
        messages: messagesForCase,
        labels: {
          expectedEvidence,
          expectedLayerMin,
          tags: ['auto-sampled', platform, expectedLayerMin]
        },
        metadata: {
          sourceMessageRange: {
            startIndex: start,
            endIndex: i,
            startMessageId: slice[0]?.sourceMessageId ?? null,
            endMessageId: slice[slice.length - 1]?.sourceMessageId ?? null
          },
          sourceDateRange: {
            start: slice[0]?.date ?? null,
            end: slice[slice.length - 1]?.date ?? null
          },
          sourceConversationSize: messages.length,
          autoLabelMethod: 'keyword-heuristic-v1'
        }
      })
    }
  }

  return candidates
}

function conversationKeyOf(candidate: CandidateCase): string {
  return `${candidate.platform}:${candidate.chatId}`
}

function pickWithConversationCap(
  pool: CandidateCase[],
  maxTake: number,
  selectedConversationCounts: Map<string, number>,
  maxCasesPerConversation: number
): { picked: CandidateCase[]; leftovers: CandidateCase[] } {
  const picked: CandidateCase[] = []
  const leftovers: CandidateCase[] = []

  for (const candidate of pool) {
    const key = conversationKeyOf(candidate)
    const used = selectedConversationCounts.get(key) ?? 0
    if (picked.length < maxTake && used < maxCasesPerConversation) {
      picked.push(candidate)
      selectedConversationCounts.set(key, used + 1)
    } else {
      leftovers.push(candidate)
    }
  }

  return { picked, leftovers }
}

function selectByLayerMix(
  candidates: CandidateCase[],
  targetCases: number,
  maxCasesPerConversation: number,
  strictConversationCap: boolean,
  rng: () => number
): CandidateCase[] {
  const buckets: Record<ContextLayer, CandidateCase[]> = {
    L0: [],
    L1: [],
    L2: []
  }
  for (const candidate of candidates) {
    buckets[candidate.expectedLayerMin].push(candidate)
  }

  shuffleInPlace(buckets.L0, rng)
  shuffleInPlace(buckets.L1, rng)
  shuffleInPlace(buckets.L2, rng)

  const targets: Record<ContextLayer, number> = {
    L0: Math.floor(targetCases * 0.4),
    L1: Math.floor(targetCases * 0.35),
    L2: Math.max(0, targetCases - Math.floor(targetCases * 0.4) - Math.floor(targetCases * 0.35))
  }

  const selected: CandidateCase[] = []
  const selectedConversationCounts = new Map<string, number>()
  const leftovers: CandidateCase[] = []

  for (const layer of ['L0', 'L1', 'L2'] as const) {
    const bucket = buckets[layer]
    const { picked, leftovers: bucketLeftovers } = pickWithConversationCap(
      bucket,
      targets[layer],
      selectedConversationCounts,
      maxCasesPerConversation
    )
    selected.push(...picked)
    leftovers.push(...bucketLeftovers)
  }

  if (selected.length < targetCases) {
    shuffleInPlace(leftovers, rng)
    const needed = targetCases - selected.length
    const { picked, leftovers: blockedByCap } = pickWithConversationCap(
      leftovers,
      needed,
      selectedConversationCounts,
      maxCasesPerConversation
    )
    selected.push(...picked)

    if (!strictConversationCap && selected.length < targetCases) {
      const stillNeeded = targetCases - selected.length
      selected.push(...blockedByCap.slice(0, stillNeeded))
    }
  }

  return selected.slice(0, targetCases)
}

function toEvalCases(selected: CandidateCase[]): ContextEvalCase[] {
  return selected.map((item, index) => ({
    id: `${item.baseId}-${String(index + 1).padStart(4, '0')}`,
    platform: item.platform,
    chatId: item.chatId,
    query: item.query,
    messages: item.messages,
    labels: item.labels,
    metadata: item.metadata
  }))
}

async function ensureDirectoryForFile(filePath: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
}

async function resolveUserDataDir(explicitPath?: string): Promise<string> {
  const fromArg = explicitPath ? resolvePath(explicitPath) : null
  if (fromArg && (await pathExists(fromArg))) {
    return fromArg
  }

  const fromEnv = process.env.CONTEXT_EVAL_USER_DATA_DIR
  if (fromEnv) {
    const resolved = resolvePath(fromEnv)
    if (await pathExists(resolved)) {
      return resolved
    }
  }

  const candidates = [
    path.join(os.homedir(), 'Library/Application Support/memu-bot'),
    path.join(os.homedir(), 'Library/Application Support/memu bot'),
    path.join(os.homedir(), 'Library/Application Support/yumi')
  ]
  for (const candidate of candidates) {
    if (await pathExists(candidate)) {
      return candidate
    }
  }

  throw new Error(
    'Cannot resolve userData directory. Pass --userDataDir or set CONTEXT_EVAL_USER_DATA_DIR.'
  )
}

function buildOptions(args: Map<string, string>, userDataDir: string): BuildOptions {
  const targetCases = Math.max(1, parseInteger(args.get('targetCases'), 100))
  const defaultMaxCasesPerConversation = Math.max(8, Math.floor(targetCases * 0.25))

  return {
    userDataDir,
    outputPath: resolvePath(
      args.get('outputPath') ?? 'tests/layered-context/datasets/context-eval.v1.jsonl'
    ),
    targetCases,
    maxCasesPerConversation: Math.max(
      1,
      parseInteger(args.get('maxCasesPerConversation'), defaultMaxCasesPerConversation)
    ),
    strictConversationCap: parseBoolean(args.get('strictConversationCap'), false),
    variantsPerQuery: Math.max(1, parseInteger(args.get('variantsPerQuery'), 3)),
    minHistoryMessages: Math.max(4, parseInteger(args.get('minHistoryMessages'), 18)),
    minWindowMessages: Math.max(6, parseInteger(args.get('minWindowMessages'), 22)),
    maxWindowMessages: Math.max(8, parseInteger(args.get('maxWindowMessages'), 48)),
    minQueryChars: Math.max(2, parseInteger(args.get('minQueryChars'), 5)),
    seed: parseInteger(args.get('seed'), 42),
    redact: parseBoolean(args.get('redact'), true),
    platforms: parsePlatforms(args.get('platforms'))
  }
}

function countBy<T extends string>(items: T[]): Record<T, number> {
  const result = {} as Record<T, number>
  for (const item of items) {
    result[item] = (result[item] ?? 0) + 1
  }
  return result
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))
  const userDataDir = await resolveUserDataDir(args.get('userDataDir'))
  const options = buildOptions(args, userDataDir)
  const rng = createSeededRng(options.seed)

  const allMessages: RawConversationMessage[] = []
  const sourceCounts: Record<string, number> = {}
  for (const platform of options.platforms) {
    const platformMessages = await loadPlatformMessages(options.userDataDir, platform, options.redact)
    allMessages.push(...platformMessages)
    sourceCounts[platform] = platformMessages.length
  }

  const groups = groupByConversation(allMessages)
  const candidates: CandidateCase[] = []
  for (const [conversationKey, conversationMessages] of groups.entries()) {
    const cases = buildCandidateCasesForConversation(conversationKey, conversationMessages, options, rng)
    candidates.push(...cases)
  }

  if (candidates.length === 0) {
    throw new Error('No candidate cases were built. Try lowering minHistoryMessages or minWindowMessages.')
  }

  shuffleInPlace(candidates, rng)
  const selected = selectByLayerMix(
    candidates,
    options.targetCases,
    options.maxCasesPerConversation,
    options.strictConversationCap,
    rng
  )
  const evalCases = toEvalCases(selected)

  await ensureDirectoryForFile(options.outputPath)
  const jsonl = evalCases.map((item) => JSON.stringify(item)).join('\n')
  await fs.writeFile(options.outputPath, `${jsonl}\n`, 'utf-8')

  const metaPath = options.outputPath.replace(/\.jsonl$/i, '.meta.json')
  const layerCounts = countBy(evalCases.map((item) => item.labels?.expectedLayerMin ?? 'L0') as ContextLayer[])
  const platformCounts = countBy(evalCases.map((item) => item.platform ?? 'telegram'))
  const selectedConversationCounts = countBy(
    evalCases.map((item) => `${item.platform ?? 'unknown'}:${item.chatId ?? 'default'}`)
  )
  const conversationEntries = Object.entries(selectedConversationCounts).sort((a, b) => b[1] - a[1])
  const topConversations = conversationEntries
    .slice(0, 5)
    .map(([conversation, count]) => ({ conversation, count }))
  const topConversationCount = topConversations[0]?.count ?? 0
  const dominantConversationRatio = evalCases.length > 0 ? topConversationCount / evalCases.length : 0
  const capExceeded = conversationEntries.some(([, count]) => count > options.maxCasesPerConversation)
  const diversityWarnings: string[] = []

  if (Object.keys(platformCounts).length < 2) {
    diversityWarnings.push('Only one platform appears in selected cases.')
  }
  if (groups.size < 3) {
    diversityWarnings.push('Very few source conversations were found; evaluation may be biased.')
  }
  if (dominantConversationRatio > 0.5) {
    diversityWarnings.push('A single conversation dominates selected cases (>50%).')
  }
  if (capExceeded) {
    diversityWarnings.push(
      'Conversation cap was relaxed to reach target case count; selected data remains concentration-prone.'
    )
  }
  if (options.strictConversationCap && evalCases.length < options.targetCases) {
    diversityWarnings.push(
      'Strict conversation cap limited selected cases below target. Consider lowering targetCases or raising per-conversation cap.'
    )
  }

  const meta = {
    generatedAt: new Date().toISOString(),
    outputPath: options.outputPath,
    userDataDir: options.userDataDir,
    options,
    sourceCounts,
    conversationCount: groups.size,
    candidateCount: candidates.length,
    selectedCount: evalCases.length,
    selectedLayerCounts: layerCounts,
    selectedPlatformCounts: platformCounts,
    selectedConversationCounts,
    topConversations,
    dominantConversationRatio,
    capExceeded,
    diversityWarnings
  }
  await fs.writeFile(metaPath, `${JSON.stringify(meta, null, 2)}\n`, 'utf-8')

  console.log(`[ContextEval:BuildV1] userData=${options.userDataDir}`)
  console.log(`[ContextEval:BuildV1] source messages => ${JSON.stringify(sourceCounts)}`)
  console.log(
    `[ContextEval:BuildV1] candidates=${candidates.length}, selected=${evalCases.length}, conversations=${groups.size}`
  )
  console.log(`[ContextEval:BuildV1] layer mix => ${JSON.stringify(layerCounts)}`)
  console.log(`[ContextEval:BuildV1] platform mix => ${JSON.stringify(platformCounts)}`)
  console.log(`[ContextEval:BuildV1] top conversations => ${JSON.stringify(topConversations)}`)
  if (diversityWarnings.length > 0) {
    console.warn(`[ContextEval:BuildV1] diversity warnings => ${JSON.stringify(diversityWarnings)}`)
  }
  console.log(`[ContextEval:BuildV1] dataset => ${options.outputPath}`)
  console.log(`[ContextEval:BuildV1] metadata => ${metaPath}`)
}

main().catch((error) => {
  console.error('[ContextEval:BuildV1] Failed:', error instanceof Error ? error.message : String(error))
  process.exit(1)
})

