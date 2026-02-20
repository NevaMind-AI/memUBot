import 'dotenv/config'
import { mkdtemp, rm } from 'fs/promises'
import * as os from 'os'
import * as path from 'path'
import type Anthropic from '@anthropic-ai/sdk'
import { FileSystemLayeredContextStorage } from '../../src/main/services/agent/context/layered/storage'
import type { LayeredContextIndexDocument, LayeredContextNode } from '../../src/main/services/agent/context/layered/types'
import {
  MemuDenseScoreProvider,
  type MemuConfig,
  type LayeredDenseScoreProvider
} from '../../src/main/services/agent/context/layered/dense-score-provider'

const LIVE_EMBEDDING_FLAG_ENV = 'LAYERED_CONTEXT_LIVE_EMBEDDING'
const LIVE_MEMU_BASE_URL_ENV = 'LAYERED_CONTEXT_MEMU_BASE_URL'
const LIVE_MEMU_API_KEY_ENV = 'LAYERED_CONTEXT_MEMU_API_KEY'
const LIVE_MEMU_TIMEOUT_ENV = 'LAYERED_CONTEXT_MEMU_TIMEOUT_MS'
const LEGACY_MEMU_BASE_URL_ENV = 'MEMU_BASE_URL'
const LEGACY_MEMU_API_KEY_ENV = 'MEMU_API_KEY'
const DEFAULT_MEMU_BASE_URL = 'https://api.memu.so'

let cachedAuthStateApiKey: string | null | undefined

export async function createTempStorage() {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'layered-context-test-'))
  const storage = new FileSystemLayeredContextStorage(dir)
  const cleanup = async () => {
    await rm(dir, { recursive: true, force: true })
  }
  return { dir, storage, cleanup }
}

export function buildMessage(role: 'user' | 'assistant', content: string): Anthropic.MessageParam {
  return { role, content }
}

export async function seedIndex(
  storage: FileSystemLayeredContextStorage,
  sessionKey: string,
  nodes: Array<{
    id: string
    abstract: string
    overview: string
    transcript: string
    keywords: string[]
    recencyRank: number
    tokenEstimate?: { l0: number; l1: number; l2: number }
  }>
): Promise<LayeredContextIndexDocument> {
  const now = Date.now()
  const layeredNodes: LayeredContextNode[] = []

  for (const node of nodes) {
    const fullPath = await storage.writeArchive(sessionKey, node.id, {
      sessionKey,
      nodeId: node.id,
      transcript: node.transcript,
      messages: [
        buildMessage('user', node.transcript),
        buildMessage('assistant', `ack:${node.id}`)
      ],
      createdAt: now
    })

    layeredNodes.push({
      id: node.id,
      parentId: 'root',
      abstract: node.abstract,
      overview: node.overview,
      fullContentPath: fullPath,
      keywords: node.keywords,
      checksum: `${node.id}-checksum`,
      metadata: {
        platform: 'telegram',
        chatId: null,
        startMessageIndex: 0,
        endMessageIndex: 10,
        messageCount: 10,
        recencyRank: node.recencyRank
      },
      tokenEstimate: node.tokenEstimate ?? { l0: 60, l1: 220, l2: 1200 },
      createdAt: now,
      updatedAt: now
    })
  }

  const doc: LayeredContextIndexDocument = {
    version: 1,
    sessionKey,
    root: {
      id: 'root',
      abstract: 'Global archived context for conversation history.',
      overview: 'Contains deployment, billing, and onboarding records.',
      keywords: ['global', 'deployment', 'billing', 'onboarding'],
      childIds: layeredNodes.map((node) => node.id),
      updatedAt: now
    },
    nodes: layeredNodes,
    createdAt: now,
    updatedAt: now
  }

  await storage.saveIndex(doc)
  return doc
}

const EMBEDDING_FEATURES = [
  'deployment',
  'deploy.ts',
  'release',
  'checklist',
  'rollout',
  'rollback',
  'billing',
  'invoice',
  'retry',
  'error',
  'line',
  'onboarding',
  'infra',
  'backup'
]

function toMockEmbedding(input: string): number[] {
  const normalized = input.toLowerCase()
  return EMBEDDING_FEATURES.map((feature) => (normalized.includes(feature) ? 1 : 0))
}

export function createMockMemuEmbeddingProvider(
  config: MemuConfig = {
    baseUrl: 'https://mock.memu.local',
    apiKey: 'test-key'
  }
): LayeredDenseScoreProvider {
  const fetchImpl: typeof fetch = async (_url, init) => {
    const body = JSON.parse(String(init?.body ?? '{}')) as { input?: string[] }
    const input = Array.isArray(body.input) ? body.input : []
    const data = input.map((text, index) => ({
      index,
      embedding: toMockEmbedding(text)
    }))
    return new Response(JSON.stringify({ data }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    })
  }

  return new MemuDenseScoreProvider({
    requestTimeoutMs: 500,
    fetchImpl,
    resolveConfig: async () => config
  })
}

function parsePositiveInteger(value: string | undefined): number | null {
  if (!value) return null
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null
  }
  return parsed
}

export function isLiveMemuEmbeddingTestEnabled(): boolean {
  return process.env[LIVE_EMBEDDING_FLAG_ENV] === '1'
}

function getLiveMemuBaseUrlFromEnv(): string | null {
  return process.env[LIVE_MEMU_BASE_URL_ENV]?.trim() || process.env[LEGACY_MEMU_BASE_URL_ENV]?.trim() || null
}

function getLiveMemuApiKeyFromEnv(): string | null {
  return process.env[LIVE_MEMU_API_KEY_ENV]?.trim() || process.env[LEGACY_MEMU_API_KEY_ENV]?.trim() || null
}

async function getMemuApiKeyFromAuthState(): Promise<string | null> {
  if (cachedAuthStateApiKey !== undefined) {
    return cachedAuthStateApiKey
  }

  try {
    const { getAuthService } = await import('../../src/main/services/auth')
    const authService = getAuthService()
    try {
      await authService.initialize()
    } catch {
      // Continue to read state even if initialization fails.
    }
    const authApiKey = authService.getAuthState().memuApiKey?.trim() || null
    cachedAuthStateApiKey = authApiKey
    return authApiKey
  } catch {
    cachedAuthStateApiKey = null
    return null
  }
}

export function createLiveMemuEmbeddingProviderFromEnv(): LayeredDenseScoreProvider {
  const baseUrl = getLiveMemuBaseUrlFromEnv() || DEFAULT_MEMU_BASE_URL

  const timeoutMs = parsePositiveInteger(process.env[LIVE_MEMU_TIMEOUT_ENV]) ?? 4000
  const liveProvider = new MemuDenseScoreProvider({
    requestTimeoutMs: timeoutMs,
    resolveConfig: async (): Promise<MemuConfig | null> => {
      const authApiKey = await getMemuApiKeyFromAuthState()
      if (authApiKey) {
        return { baseUrl, apiKey: authApiKey }
      }

      const envApiKey = getLiveMemuApiKeyFromEnv()
      if (envApiKey) {
        return { baseUrl, apiKey: envApiKey }
      }

      return null
    }
  })

  return {
    async getDenseScores(input) {
      const scores = await liveProvider.getDenseScores(input)
      const hasPositiveScore = Array.from(scores.values()).some((score) => score > 0)
      if (!hasPositiveScore) {
        const envApiKey = getLiveMemuApiKeyFromEnv()
        const authApiKey = await getMemuApiKeyFromAuthState()
        if (!envApiKey && !authApiKey) {
          throw new Error(
            `Live Memu embedding test did not find API key. Set ${LIVE_MEMU_API_KEY_ENV}/${LEGACY_MEMU_API_KEY_ENV} or make getAuthService().getAuthState().memuApiKey available.`
          )
        }
        throw new Error('Live Memu embedding test expected positive dense scores, but none were returned.')
      }
      return scores
    }
  }
}

export function createLayeredTestDenseScoreProvider(): LayeredDenseScoreProvider {
  if (!isLiveMemuEmbeddingTestEnabled()) {
    return createMockMemuEmbeddingProvider()
  }

  return createLiveMemuEmbeddingProviderFromEnv()
}
