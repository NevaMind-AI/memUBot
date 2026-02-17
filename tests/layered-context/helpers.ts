import { mkdtemp, rm } from 'fs/promises'
import * as os from 'os'
import * as path from 'path'
import type Anthropic from '@anthropic-ai/sdk'
import { FileSystemLayeredContextStorage } from '../../src/main/services/agent/context/layered/storage'
import type { LayeredContextIndexDocument, LayeredContextNode } from '../../src/main/services/agent/context/layered/types'

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
