import { access, mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import type Anthropic from '@anthropic-ai/sdk'
import { DEFAULT_LAYERED_CONTEXT_CONFIG } from '../../src/main/services/agent/context/layered/config'
import { MemuDenseScoreProvider } from '../../src/main/services/agent/context/layered/dense-score-provider'
import { LayeredContextIndexer } from '../../src/main/services/agent/context/layered/indexer'
import { LayeredContextManager } from '../../src/main/services/agent/context/layered/manager'
import { LayeredContextRetriever } from '../../src/main/services/agent/context/layered/retriever'
import { LayeredSummaryGenerator } from '../../src/main/services/agent/context/layered/summarizer'
import { flattenMessageContent } from '../../src/main/services/agent/context/layered/message-utils'
import { FileSystemLayeredContextStorage } from '../../src/main/services/agent/context/layered/storage'
import type { ContextLayer, LayeredContextConfig } from '../../src/main/services/agent/context/layered/types'
import { estimateTokens } from '../../src/main/services/agent/context/token-estimator'
import { ensureTrailingUserQuery, loadDataset } from './dataset'
import { writeRunArtifacts } from './reporter'
import { scoreEvidenceCoverage, summarizeResults } from './scorer'
import type {
  CaseEvaluationResult,
  EvalRunnerConfig,
  EvaluatedVariant,
  NormalizedContextEvalCase
} from './types'

const LAYER_WEIGHT: Record<ContextLayer, number> = {
  L0: 0,
  L1: 1,
  L2: 2
}

const DEFAULT_EMBEDDING_BASE_URL = 'https://api.memu.so'
const DEFAULT_EMBEDDING_TIMEOUT_MS = 1200

interface ResolvedEmbeddingConfig {
  enabled: boolean
  required: boolean
  baseUrl: string
  apiKey: string
  timeoutMs: number
  source: 'arg' | 'env' | 'auth-service' | 'auth-session' | 'settings' | 'none'
  userDataDir: string | null
}

function parseArgs(argv: string[]): Map<string, string> {
  const values = new Map<string, string>()
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i]
    if (!token.startsWith('--')) continue
    const key = token.slice(2)
    const next = argv[i + 1]
    if (!next || next.startsWith('--')) {
      values.set(key, 'true')
      continue
    }
    values.set(key, next)
    i++
  }
  return values
}

function resolvePath(input: string): string {
  if (path.isAbsolute(input)) return input
  return path.resolve(process.cwd(), input)
}

function parseIntegerArg(input: string | undefined, fallback: number): number {
  if (!input) return fallback
  const parsed = Number.parseInt(input, 10)
  if (!Number.isFinite(parsed)) return fallback
  return parsed
}

function parseFloatArg(input: string | undefined, fallback: number): number {
  if (!input) return fallback
  const parsed = Number.parseFloat(input)
  if (!Number.isFinite(parsed)) return fallback
  return parsed
}

function parseBooleanArg(input: string | undefined, fallback: boolean): boolean {
  if (!input) return fallback
  const normalized = input.trim().toLowerCase()
  if (normalized === '1' || normalized === 'true' || normalized === 'yes') return true
  if (normalized === '0' || normalized === 'false' || normalized === 'no') return false
  return fallback
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await access(targetPath)
    return true
  } catch {
    return false
  }
}

async function readJsonRecord(targetPath: string): Promise<Record<string, unknown> | null> {
  if (!(await pathExists(targetPath))) return null
  try {
    const content = await readFile(targetPath, 'utf-8')
    const parsed = JSON.parse(content) as unknown
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>
    }
    return null
  } catch {
    return null
  }
}

function readStringField(record: Record<string, unknown> | null, key: string): string {
  if (!record) return ''
  const value = record[key]
  return typeof value === 'string' ? value.trim() : ''
}

async function resolveUserDataDirForRunner(args: Map<string, string>): Promise<string | null> {
  const argPath = args.get('userDataDir')
  if (argPath) {
    const resolved = resolvePath(argPath)
    if (await pathExists(resolved)) return resolved
  }

  const envPath = process.env.CONTEXT_EVAL_USER_DATA_DIR?.trim()
  if (envPath) {
    const resolved = resolvePath(envPath)
    if (await pathExists(resolved)) return resolved
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

  return null
}

async function resolveEmbeddingConfigFromAuthService(): Promise<{ apiKey: string; baseUrl: string } | null> {
  try {
    const [{ getAuthService }, { loadSettings }] = await Promise.all([
      import('../../src/main/services/auth'),
      import('../../src/main/config/settings.config')
    ])

    const authService = getAuthService()
    try {
      await authService.initialize()
    } catch {
      // Continue best-effort: some tests preload auth state without full runtime init.
    }

    const authApiKey = authService.getAuthState().memuApiKey?.trim() || ''
    if (!authApiKey) return null

    let baseUrl = DEFAULT_EMBEDDING_BASE_URL
    try {
      const settings = await loadSettings()
      if (settings.memuBaseUrl?.trim()) {
        baseUrl = settings.memuBaseUrl.trim()
      }
    } catch {
      // Keep default base url.
    }

    return {
      apiKey: authApiKey,
      baseUrl
    }
  } catch {
    return null
  }
}

async function resolveEmbeddingConfig(args: Map<string, string>): Promise<ResolvedEmbeddingConfig> {
  const enabled = parseBooleanArg(args.get('withEmbedding'), true)
  const required = parseBooleanArg(args.get('requireEmbedding'), true)
  if (!enabled && required) {
    throw new Error('Embedding is required but --withEmbedding is false.')
  }

  const timeoutMs = Math.max(200, parseIntegerArg(args.get('embeddingTimeoutMs'), DEFAULT_EMBEDDING_TIMEOUT_MS))

  const argApiKey = args.get('embeddingApiKey')?.trim() ?? ''
  const argBaseUrl = args.get('embeddingBaseUrl')?.trim() ?? ''
  if (argApiKey) {
    return {
      enabled,
      required,
      apiKey: argApiKey,
      baseUrl: argBaseUrl || DEFAULT_EMBEDDING_BASE_URL,
      timeoutMs,
      source: 'arg',
      userDataDir: null
    }
  }

  const envApiKey =
    process.env.CONTEXT_EVAL_EMBEDDING_API_KEY?.trim() || process.env.MEMU_API_KEY?.trim() || ''
  const envBaseUrl =
    process.env.CONTEXT_EVAL_EMBEDDING_BASE_URL?.trim() || process.env.MEMU_BASE_URL?.trim() || ''
  if (envApiKey) {
    return {
      enabled,
      required,
      apiKey: envApiKey,
      baseUrl: argBaseUrl || envBaseUrl || DEFAULT_EMBEDDING_BASE_URL,
      timeoutMs,
      source: 'env',
      userDataDir: null
    }
  }

  const authServiceConfig = await resolveEmbeddingConfigFromAuthService()
  if (authServiceConfig?.apiKey) {
    return {
      enabled,
      required,
      apiKey: authServiceConfig.apiKey,
      baseUrl: argBaseUrl || authServiceConfig.baseUrl || envBaseUrl || DEFAULT_EMBEDDING_BASE_URL,
      timeoutMs,
      source: 'auth-service',
      userDataDir: null
    }
  }

  const userDataDir = await resolveUserDataDirForRunner(args)
  if (userDataDir) {
    const authSession = await readJsonRecord(path.join(userDataDir, 'auth', 'session.json'))
    const settings = await readJsonRecord(path.join(userDataDir, 'config', 'settings.json'))
    const sessionApiKey = readStringField(authSession, 'memuApiKey')
    const settingsApiKey = readStringField(settings, 'memuApiKey')
    const settingsBaseUrl = readStringField(settings, 'memuBaseUrl')
    const discoveredApiKey = sessionApiKey || settingsApiKey
    if (discoveredApiKey) {
      return {
        enabled,
        required,
        apiKey: discoveredApiKey,
        baseUrl: argBaseUrl || settingsBaseUrl || envBaseUrl || DEFAULT_EMBEDDING_BASE_URL,
        timeoutMs,
        source: sessionApiKey ? 'auth-session' : 'settings',
        userDataDir
      }
    }
  }

  const fallbackBaseUrl = argBaseUrl || envBaseUrl || DEFAULT_EMBEDDING_BASE_URL
  if (enabled && required) {
    throw new Error(
      'Embedding is required but no API key was found. Provide --embeddingApiKey, set CONTEXT_EVAL_EMBEDDING_API_KEY/MEMU_API_KEY, or ensure getAuthService().getAuthState().memuApiKey is populated.'
    )
  }

  return {
    enabled,
    required,
    apiKey: '',
    baseUrl: fallbackBaseUrl,
    timeoutMs,
    source: 'none',
    userDataDir
  }
}

function createRunId(): string {
  return new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '-')
}

function cloneMessages(messages: Anthropic.MessageParam[]): Anthropic.MessageParam[] {
  return messages.map((message) => {
    const content =
      typeof message.content === 'string'
        ? message.content
        : (JSON.parse(JSON.stringify(message.content)) as Anthropic.MessageParam['content'])
    return {
      role: message.role,
      content
    }
  })
}

function estimatePromptTokens(messages: Anthropic.MessageParam[]): number {
  return messages.reduce((sum, message) => sum + estimateTokens(message), 0)
}

function trimMessagesToBudget(messages: Anthropic.MessageParam[], maxPromptTokens: number): Anthropic.MessageParam[] {
  const trimmed = cloneMessages(messages)
  while (trimmed.length > 2 && estimatePromptTokens(trimmed) > maxPromptTokens) {
    trimmed.shift()
  }
  return trimmed
}

function buildContextText(messages: Anthropic.MessageParam[]): string {
  const lines: string[] = []
  for (const message of messages) {
    const role = message.role === 'assistant' ? 'ASSISTANT' : 'USER'
    const text = flattenMessageContent(message).trim()
    if (!text) continue
    lines.push(`${role}: ${text}`)
  }
  return lines.join('\n')
}

function toContextPreview(text: string, maxLength: number = 280): string {
  if (text.length <= maxLength) return text
  return `${text.slice(0, maxLength - 3)}...`
}

function isLayerAtLeast(actual: ContextLayer | null, expectedMin: ContextLayer): boolean {
  if (!actual) return false
  return LAYER_WEIGHT[actual] >= LAYER_WEIGHT[expectedMin]
}

function evaluateLayerAdequacy(caseInput: NormalizedContextEvalCase, candidate: EvaluatedVariant): boolean | null {
  const expectedMin = caseInput.labels.expectedLayerMin
  if (!expectedMin) return null
  return isLayerAtLeast(candidate.reachedLayer, expectedMin)
}

function buildExplanation(
  caseInput: NormalizedContextEvalCase,
  baseline: EvaluatedVariant,
  candidate: EvaluatedVariant,
  promptTokenSavingsRatio: number,
  evidenceRecallDelta: number | null,
  layerAdequacyPass: boolean | null,
  informationLossIncident: boolean | null,
  layeredConfig: LayeredContextConfig
): string[] {
  const explanation: string[] = []
  if (promptTokenSavingsRatio >= 0) {
    explanation.push(`Candidate reduced prompt tokens by ${(promptTokenSavingsRatio * 100).toFixed(2)}%.`)
  } else {
    explanation.push(`Candidate increased prompt tokens by ${(Math.abs(promptTokenSavingsRatio) * 100).toFixed(2)}%.`)
  }

  if (!candidate.layeredApplied) {
    explanation.push('Layered strategy was not applied for this case (history may be too short for archival split).')
  } else if (candidate.reachedLayer) {
    explanation.push(`Retriever escalated to ${candidate.reachedLayer}${candidate.decisionReason ? `: ${candidate.decisionReason}` : '.'}`)
  }

  if (evidenceRecallDelta !== null && evidenceRecallDelta < 0) {
    const missing = candidate.evidenceScore?.missingEvidence ?? []
    if (missing.length > 0) {
      explanation.push(`Candidate missed expected evidence: ${missing.join(', ')}.`)
    } else {
      explanation.push('Candidate evidence recall dropped compared with baseline.')
    }
  }

  if (layerAdequacyPass === false && caseInput.labels.expectedLayerMin) {
    explanation.push(
      `Expected at least ${caseInput.labels.expectedLayerMin}, but candidate reached ${candidate.reachedLayer ?? 'none'}.`
    )
  }

  const approximateLayerBudget = Math.max(400, Math.floor(layeredConfig.maxPromptTokens * 0.45))
  if (
    candidate.retrievalTokenUsage &&
    candidate.retrievalTokenUsage.total >= approximateLayerBudget * 0.95 &&
    (candidate.evidenceScore?.missingEvidence.length ?? 0) > 0
  ) {
    explanation.push('Layered retrieval likely hit budget pressure; important evidence may be truncated.')
  }

  if (informationLossIncident) {
    explanation.push('Information loss incident: baseline contained all expected evidence, candidate did not.')
  }

  return explanation
}

function evaluateBaselineVariant(
  caseInput: NormalizedContextEvalCase,
  messages: Anthropic.MessageParam[],
  layeredConfig: LayeredContextConfig
): EvaluatedVariant {
  const trimmedMessages = trimMessagesToBudget(messages, layeredConfig.maxPromptTokens)
  const contextText = buildContextText(trimmedMessages)
  const expectedEvidence = caseInput.labels.expectedEvidence ?? []
  const evidenceScore = expectedEvidence.length > 0 ? scoreEvidenceCoverage(contextText, expectedEvidence) : null

  return {
    promptTokens: estimatePromptTokens(trimmedMessages),
    messageCount: trimmedMessages.length,
    contextText,
    contextPreview: toContextPreview(contextText),
    evidenceScore,
    layeredApplied: false,
    reachedLayer: null,
    decisionReason: null,
    retrievalTokenUsage: null
  }
}

async function evaluateCandidateVariant(
  caseInput: NormalizedContextEvalCase,
  messages: Anthropic.MessageParam[],
  layeredConfig: LayeredContextConfig,
  manager: LayeredContextManager
): Promise<EvaluatedVariant> {
  const sessionKey = `${caseInput.platform}:${caseInput.id}`
  const applicationResult = await manager.apply({
    sessionKey,
    platform: caseInput.platform,
    chatId: caseInput.chatId,
    query: caseInput.query,
    messages: cloneMessages(messages),
    config: layeredConfig
  })

  const postMessages = trimMessagesToBudget(applicationResult.updatedMessages, layeredConfig.maxPromptTokens)
  const contextText = buildContextText(postMessages)
  const expectedEvidence = caseInput.labels.expectedEvidence ?? []
  const evidenceScore = expectedEvidence.length > 0 ? scoreEvidenceCoverage(contextText, expectedEvidence) : null

  return {
    promptTokens: estimatePromptTokens(postMessages),
    messageCount: postMessages.length,
    contextText,
    contextPreview: toContextPreview(contextText),
    evidenceScore,
    layeredApplied: applicationResult.applied && applicationResult.retrieval !== null,
    reachedLayer: applicationResult.retrieval?.decision.reachedLayer ?? null,
    decisionReason: applicationResult.retrieval?.decision.reason ?? null,
    retrievalTokenUsage: applicationResult.retrieval?.tokenUsage ?? null
  }
}

async function evaluateCase(
  caseInput: NormalizedContextEvalCase,
  layeredConfig: LayeredContextConfig,
  manager: LayeredContextManager
): Promise<CaseEvaluationResult> {
  const canonicalMessages = ensureTrailingUserQuery(cloneMessages(caseInput.messages), caseInput.query)
  const baseline = evaluateBaselineVariant(caseInput, canonicalMessages, layeredConfig)
  const candidate = await evaluateCandidateVariant(caseInput, canonicalMessages, layeredConfig, manager)

  const promptTokenSavingsRatio =
    baseline.promptTokens > 0 ? (baseline.promptTokens - candidate.promptTokens) / baseline.promptTokens : 0
  const evidenceRecallDelta =
    baseline.evidenceScore && candidate.evidenceScore
      ? candidate.evidenceScore.recall - baseline.evidenceScore.recall
      : null
  const layerAdequacyPass = evaluateLayerAdequacy(caseInput, candidate)
  const informationLossIncident =
    baseline.evidenceScore && candidate.evidenceScore
      ? baseline.evidenceScore.missingEvidence.length === 0 && candidate.evidenceScore.missingEvidence.length > 0
      : null

  const explanation = buildExplanation(
    caseInput,
    baseline,
    candidate,
    promptTokenSavingsRatio,
    evidenceRecallDelta,
    layerAdequacyPass,
    informationLossIncident,
    layeredConfig
  )

  return {
    caseId: caseInput.id,
    query: caseInput.query,
    expectedEvidenceCount: caseInput.labels.expectedEvidence?.length ?? 0,
    expectedLayerMin: caseInput.labels.expectedLayerMin ?? null,
    baseline,
    candidate,
    promptTokenSavingsRatio,
    evidenceRecallDelta,
    layerAdequacyPass,
    informationLossIncident,
    explanation
  }
}

function buildRunnerConfig(args: Map<string, string>): EvalRunnerConfig {
  const datasetPath = resolvePath(
    args.get('dataset') ?? 'tests/layered-context/datasets/context-eval.template.jsonl'
  )
  const outputDir = resolvePath(args.get('outputDir') ?? 'reports/context-eval')
  const runId = args.get('runId') ?? createRunId()

  const baseConfig = DEFAULT_LAYERED_CONTEXT_CONFIG
  const layeredConfig: LayeredContextConfig = {
    ...baseConfig,
    enableSessionCompression: true,
    l0TargetTokens: parseIntegerArg(args.get('l0TargetTokens'), baseConfig.l0TargetTokens),
    l1TargetTokens: parseIntegerArg(args.get('l1TargetTokens'), baseConfig.l1TargetTokens),
    maxPromptTokens: parseIntegerArg(args.get('maxPromptTokens'), baseConfig.maxPromptTokens),
    maxArchives: parseIntegerArg(args.get('maxArchives'), baseConfig.maxArchives),
    maxRecentMessages: parseIntegerArg(args.get('maxRecentMessages'), baseConfig.maxRecentMessages),
    archiveChunkSize: parseIntegerArg(args.get('archiveChunkSize'), baseConfig.archiveChunkSize),
    retrievalEscalationThresholds: {
      ...baseConfig.retrievalEscalationThresholds,
      scoreThresholdHigh: parseFloatArg(
        args.get('scoreThresholdHigh'),
        baseConfig.retrievalEscalationThresholds.scoreThresholdHigh
      ),
      top1Top2Margin: parseFloatArg(
        args.get('top1Top2Margin'),
        baseConfig.retrievalEscalationThresholds.top1Top2Margin
      ),
      maxItemsForL1: parseIntegerArg(
        args.get('maxItemsForL1'),
        baseConfig.retrievalEscalationThresholds.maxItemsForL1
      ),
      maxItemsForL2: parseIntegerArg(
        args.get('maxItemsForL2'),
        baseConfig.retrievalEscalationThresholds.maxItemsForL2
      )
    }
  }

  const rawMaxCases = args.get('maxCases')
  const maxCases =
    rawMaxCases && Number.isFinite(Number(rawMaxCases))
      ? Math.max(1, Number.parseInt(rawMaxCases, 10))
      : null

  return {
    datasetPath,
    outputDir,
    runId,
    maxCases,
    layeredConfig
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))
  const embeddingConfig = await resolveEmbeddingConfig(args)
  const config = buildRunnerConfig(args)
  const loadedCases = await loadDataset(config.datasetPath)
  const selectedCases = config.maxCases ? loadedCases.slice(0, config.maxCases) : loadedCases

  const tempStorageDir = await mkdtemp(path.join(os.tmpdir(), 'context-eval-'))
  try {
    const storage = new FileSystemLayeredContextStorage(tempStorageDir)
    const summaryGenerator = new LayeredSummaryGenerator()
    const indexer = new LayeredContextIndexer(storage, summaryGenerator)
    const denseScoreProvider = embeddingConfig.enabled
      ? new MemuDenseScoreProvider({
          requestTimeoutMs: embeddingConfig.timeoutMs,
          strictMode: embeddingConfig.required,
          resolveConfig: async () => ({
            baseUrl: embeddingConfig.baseUrl,
            apiKey: embeddingConfig.apiKey
          })
        })
      : undefined
    const retriever = new LayeredContextRetriever(storage, denseScoreProvider)
    const manager = new LayeredContextManager(storage, indexer, retriever)

    console.log(
      `[ContextEval] Embedding ${embeddingConfig.enabled ? 'enabled' : 'disabled'}; required=${
        embeddingConfig.required
      }; source=${embeddingConfig.source}; timeoutMs=${embeddingConfig.timeoutMs}`
    )
    if (embeddingConfig.userDataDir) {
      console.log(`[ContextEval] Embedding config discovery path: ${embeddingConfig.userDataDir}`)
    }

    const results: CaseEvaluationResult[] = []
    for (const [index, caseInput] of selectedCases.entries()) {
      const result = await evaluateCase(caseInput, config.layeredConfig, manager)
      results.push(result)
      console.log(
        `[ContextEval] ${index + 1}/${selectedCases.length} ${result.caseId}: token=${(
          result.promptTokenSavingsRatio * 100
        ).toFixed(2)}% evidenceDelta=${result.evidenceRecallDelta !== null ? (result.evidenceRecallDelta * 100).toFixed(2) : 'n/a'}%`
      )
    }

    const summary = summarizeResults(results, config)
    const artifacts = await writeRunArtifacts(summary, results)

    console.log(`[ContextEval] Completed run ${summary.runId}`)
    console.log(`[ContextEval] Summary JSON: ${artifacts.summaryJsonPath}`)
    console.log(`[ContextEval] Summary Markdown: ${artifacts.summaryMarkdownPath}`)
    console.log(`[ContextEval] Cases CSV: ${artifacts.casesCsvPath}`)
    console.log(`[ContextEval] Regressions: ${artifacts.regressionsPath}`)
    console.log(
      `[ContextEval] Layered application => applied=${summary.metrics.layeredApplication.appliedCaseCount}/${
        summary.caseCount
      } (${(summary.metrics.layeredApplication.applyRate * 100).toFixed(2)}%), appliedSavings=${
        summary.metrics.layeredApplication.promptTokensWhenApplied
          ? `${(summary.metrics.layeredApplication.promptTokensWhenApplied.savingsRatio.mean * 100).toFixed(2)}%`
          : 'n/a'
      }`
    )
    console.log(
      `[ContextEval] Gate metrics => savings=${(summary.metrics.promptTokens.savingsRatio.mean * 100).toFixed(
        2
      )}%, evidenceDelta=${
        summary.metrics.evidenceRecall.delta
          ? `${(summary.metrics.evidenceRecall.delta.mean * 100).toFixed(2)}%`
          : 'n/a'
      }, infoLoss=${
        summary.metrics.informationLossRate !== null
          ? `${(summary.metrics.informationLossRate * 100).toFixed(2)}%`
          : 'n/a'
      }`
    )
  } finally {
    await rm(tempStorageDir, { recursive: true, force: true })
  }
}

main().catch((error) => {
  console.error('[ContextEval] Runner failed:', error instanceof Error ? error.message : String(error))
  process.exit(1)
})

