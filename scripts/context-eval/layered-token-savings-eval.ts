import 'dotenv/config'
import path from 'node:path'
import os from 'node:os'
import { mkdtemp, rm } from 'node:fs/promises'
import { loadDataset, ensureTrailingUserQuery } from './dataset'
import { FileSystemLayeredContextStorage } from '../../src/main/services/agent/context/layered/storage'
import { LayeredSummaryGenerator } from '../../src/main/services/agent/context/layered/summarizer'
import { LayeredContextIndexer } from '../../src/main/services/agent/context/layered/indexer'
import { LayeredContextRetriever } from '../../src/main/services/agent/context/layered/retriever'
import { LayeredContextManager } from '../../src/main/services/agent/context/layered/manager'
import { MemuDenseScoreProvider } from '../../src/main/services/agent/context/layered/dense-score-provider'
import { DEFAULT_LAYERED_CONTEXT_CONFIG } from '../../src/main/services/agent/context/layered/config'
import { estimateTokens } from '../../src/main/services/agent/context/token-estimator'
import type Anthropic from '@anthropic-ai/sdk'

type LayerName = 'L0' | 'L1' | 'L2'

interface EvalCliOptions {
  datasetPath: string
  limit: number | null
  maxRecentMessages: number
  archiveChunkSize: number
  maxArchives: number
  maxPromptTokens: number
}

interface CaseSummary {
  id: string
  reachedLayer: LayerName
  promptBefore: number
  promptAfter: number
  promptSavingsTokens: number
  promptSavingsRatio: number
  retrievalSavingsTokens: number
  retrievalSavingsRatio: number
}

const DEFAULT_DATASET_PATH = 'tests/layered-context/datasets/context-eval.temporary-topic.large-1000.jsonl'
const DEFAULT_MAX_RECENT_MESSAGES = 2
const DEFAULT_ARCHIVE_CHUNK_SIZE = 2
const DEFAULT_MAX_ARCHIVES = 12
const DEFAULT_MAX_PROMPT_TOKENS = 32000

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return parsed
}

function parseOptionalLimit(value: string | undefined): number | null {
  if (!value) return null
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) return null
  return parsed
}

function parseArgs(argv: string[]): EvalCliOptions {
  const args = [...argv]
  let datasetPath = DEFAULT_DATASET_PATH
  let limit: number | null = null
  let maxRecentMessages = DEFAULT_MAX_RECENT_MESSAGES
  let archiveChunkSize = DEFAULT_ARCHIVE_CHUNK_SIZE
  let maxArchives = DEFAULT_MAX_ARCHIVES
  let maxPromptTokens = DEFAULT_MAX_PROMPT_TOKENS

  for (let i = 0; i < args.length; i++) {
    const token = args[i]
    if (token === '--dataset' && i + 1 < args.length) {
      datasetPath = args[++i]
      continue
    }
    if (token === '--limit' && i + 1 < args.length) {
      limit = parseOptionalLimit(args[++i])
      continue
    }
    if (token === '--max-recent' && i + 1 < args.length) {
      maxRecentMessages = parsePositiveInt(args[++i], DEFAULT_MAX_RECENT_MESSAGES)
      continue
    }
    if (token === '--archive-chunk' && i + 1 < args.length) {
      archiveChunkSize = parsePositiveInt(args[++i], DEFAULT_ARCHIVE_CHUNK_SIZE)
      continue
    }
    if (token === '--max-archives' && i + 1 < args.length) {
      maxArchives = parsePositiveInt(args[++i], DEFAULT_MAX_ARCHIVES)
      continue
    }
    if (token === '--max-prompt-tokens' && i + 1 < args.length) {
      maxPromptTokens = parsePositiveInt(args[++i], DEFAULT_MAX_PROMPT_TOKENS)
      continue
    }
  }

  return {
    datasetPath,
    limit,
    maxRecentMessages,
    archiveChunkSize,
    maxArchives,
    maxPromptTokens
  }
}

function readEnv(name: string): string {
  return process.env[name]?.trim() ?? ''
}

function resolveMemuConfigFromEnv(): { baseUrl: string; apiKey: string; timeoutMs: number } {
  const apiKey = readEnv('LAYERED_CONTEXT_MEMU_API_KEY') || readEnv('MEMU_API_KEY')
  const baseUrl = readEnv('LAYERED_CONTEXT_MEMU_BASE_URL') || readEnv('MEMU_BASE_URL') || 'https://api.memu.so'
  const timeoutMs = parsePositiveInt(readEnv('LAYERED_CONTEXT_MEMU_TIMEOUT_MS'), 6000)

  if (!apiKey) {
    throw new Error(
      'Missing MEMU API key. Set MEMU_API_KEY or LAYERED_CONTEXT_MEMU_API_KEY in environment (.env is supported).'
    )
  }

  return { baseUrl, apiKey, timeoutMs }
}

function sumMessageTokens(messages: Anthropic.MessageParam[]): number {
  return messages.reduce((sum, message) => sum + estimateTokens(message), 0)
}

function ratio(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0
  return numerator / denominator
}

function toPercent(value: number): number {
  return Number((value * 100).toFixed(2))
}

async function run(): Promise<void> {
  const options = parseArgs(process.argv.slice(2))
  const datasetAbsolutePath = path.resolve(options.datasetPath)
  const cases = await loadDataset(datasetAbsolutePath)
  const targetCases = options.limit ? cases.slice(0, options.limit) : cases

  const { baseUrl, apiKey, timeoutMs } = resolveMemuConfigFromEnv()

  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'layered-savings-eval-'))
  const storage = new FileSystemLayeredContextStorage(tempDir)
  const summaryGenerator = new LayeredSummaryGenerator()
  const indexer = new LayeredContextIndexer(storage, summaryGenerator)
  const denseProvider = new MemuDenseScoreProvider({
    requestTimeoutMs: timeoutMs,
    resolveConfig: async () => ({ baseUrl, apiKey })
  })
  const retriever = new LayeredContextRetriever(storage, denseProvider)
  const manager = new LayeredContextManager(storage, indexer, retriever)

  const config = {
    ...DEFAULT_LAYERED_CONTEXT_CONFIG,
    enableSessionCompression: true,
    maxPromptTokens: options.maxPromptTokens,
    maxRecentMessages: options.maxRecentMessages,
    maxArchives: options.maxArchives,
    archiveChunkSize: options.archiveChunkSize
  }

  let totalPromptBefore = 0
  let totalPromptAfter = 0
  let totalRetrievalBaseline = 0
  let totalRetrievalActual = 0
  let appliedCases = 0
  let skippedCases = 0
  const layerCounts: Record<LayerName, number> = { L0: 0, L1: 0, L2: 0 }
  const samples: CaseSummary[] = []

  try {
    for (const entry of targetCases) {
      const messages = ensureTrailingUserQuery(entry.messages, entry.query)
      const promptBefore = sumMessageTokens(messages)
      const sessionKey = `${entry.platform}:${entry.chatId || 'default'}:${entry.id}`

      const result = await manager.apply({
        sessionKey,
        platform: entry.platform,
        chatId: entry.chatId,
        query: entry.query,
        messages,
        config
      })

      if (!result.applied || !result.retrieval) {
        skippedCases++
        continue
      }

      appliedCases++
      const promptAfter = sumMessageTokens(result.updatedMessages)
      const promptSavingsTokens = promptBefore - promptAfter
      const promptSavingsRatio = ratio(promptSavingsTokens, promptBefore)
      const retrievalActual = result.retrieval.tokenUsage.total
      const retrievalBaseline = result.retrieval.tokenUsage.baselineL2
      const retrievalSavingsTokens = retrievalBaseline - retrievalActual
      const retrievalSavingsRatio = ratio(retrievalSavingsTokens, retrievalBaseline)
      const reachedLayer = result.retrieval.decision.reachedLayer

      layerCounts[reachedLayer] += 1
      totalPromptBefore += promptBefore
      totalPromptAfter += promptAfter
      totalRetrievalBaseline += retrievalBaseline
      totalRetrievalActual += retrievalActual

      if (samples.length < 20) {
        samples.push({
          id: entry.id,
          reachedLayer,
          promptBefore,
          promptAfter,
          promptSavingsTokens,
          promptSavingsRatio,
          retrievalSavingsTokens,
          retrievalSavingsRatio
        })
      }
    }
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }

  const promptSavingsTokens = totalPromptBefore - totalPromptAfter
  const promptSavingsRatio = ratio(promptSavingsTokens, totalPromptBefore)
  const retrievalSavingsTokens = totalRetrievalBaseline - totalRetrievalActual
  const retrievalSavingsRatio = ratio(retrievalSavingsTokens, totalRetrievalBaseline)

  const summary = {
    datasetPath: datasetAbsolutePath,
    datasetCases: cases.length,
    evaluatedCases: targetCases.length,
    appliedCases,
    skippedCases,
    config: {
      maxPromptTokens: config.maxPromptTokens,
      maxRecentMessages: config.maxRecentMessages,
      maxArchives: config.maxArchives,
      archiveChunkSize: config.archiveChunkSize
    },
    layerDistribution: layerCounts,
    prompt: {
      before: totalPromptBefore,
      after: totalPromptAfter,
      savingsTokens: promptSavingsTokens,
      savingsRatio: toPercent(promptSavingsRatio)
    },
    retrieval: {
      baselineL2: totalRetrievalBaseline,
      actual: totalRetrievalActual,
      savingsTokens: retrievalSavingsTokens,
      savingsRatio: toPercent(retrievalSavingsRatio)
    },
    sampleCases: samples.map((sample) => ({
      id: sample.id,
      reachedLayer: sample.reachedLayer,
      promptBefore: sample.promptBefore,
      promptAfter: sample.promptAfter,
      promptSavingsTokens: sample.promptSavingsTokens,
      promptSavingsRatio: toPercent(sample.promptSavingsRatio),
      retrievalSavingsTokens: sample.retrievalSavingsTokens,
      retrievalSavingsRatio: toPercent(sample.retrievalSavingsRatio)
    }))
  }

  console.log('[LayeredTokenSavingsEval]', JSON.stringify(summary, null, 2))
}

run().catch((error) => {
  console.error('[LayeredTokenSavingsEval] failed:', error)
  process.exit(1)
})
