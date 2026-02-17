import test from 'node:test'
import assert from 'node:assert/strict'
import { LayeredContextRetriever } from '../../src/main/services/agent/context/layered/retriever'
import { DEFAULT_LAYERED_CONTEXT_CONFIG } from '../../src/main/services/agent/context/layered/config'
import { createTempStorage, seedIndex } from './helpers'

test('retrieval chooses correct node across L0/L1/L2 paths', async () => {
  const { storage, cleanup } = await createTempStorage()
  try {
    const index = await seedIndex(storage, 'telegram:default', [
      {
        id: 'billing-node',
        abstract: 'Billing migration summary and payment retry policy.',
        overview: 'Detailed overview about invoice retries, duplicate charges, and migration checkpoints.',
        transcript: 'Billing migration detailed transcript with retry policy and reconciliation checklist.',
        keywords: ['billing', 'migration', 'retry', 'invoice'],
        recencyRank: 1
      },
      {
        id: 'infra-node',
        abstract: 'Infrastructure operations summary.',
        overview: 'General infrastructure operations and backups.',
        transcript: 'Infrastructure backups and maintenance notes.',
        keywords: ['infra', 'backup'],
        recencyRank: 2
      }
    ])

    const retriever = new LayeredContextRetriever(storage)

    const broad = await retriever.retrieve(index, 'billing migration overview', {
      ...DEFAULT_LAYERED_CONTEXT_CONFIG,
      maxPromptTokens: 5000
    })
    assert.ok(broad.selections.some((item) => item.nodeId === 'billing-node'))

    const precise = await retriever.retrieve(index, 'exact invoice retry parameter in billing migration', {
      ...DEFAULT_LAYERED_CONTEXT_CONFIG,
      maxPromptTokens: 5000
    })
    assert.equal(precise.decision.reachedLayer, 'L2')
    assert.ok(precise.selections.some((item) => item.layer === 'L2' && item.nodeId === 'billing-node'))
  } finally {
    await cleanup()
  }
})

test('retrieval enforces max prompt token budget', async () => {
  const { storage, cleanup } = await createTempStorage()
  try {
    const largeTranscript =
      'error line 42 in deploy.ts '.repeat(300) +
      'rollback command and postmortem notes '.repeat(300)

    const index = await seedIndex(storage, 'telegram:default', [
      {
        id: 'deploy-a',
        abstract: 'Deployment incident summary A.',
        overview: 'Incident A overview with root cause and mitigation.',
        transcript: largeTranscript,
        keywords: ['deployment', 'incident', 'line', 'deploy.ts'],
        recencyRank: 1,
        tokenEstimate: { l0: 80, l1: 300, l2: 3000 }
      },
      {
        id: 'deploy-b',
        abstract: 'Deployment incident summary B.',
        overview: 'Incident B overview with root cause and mitigation.',
        transcript: largeTranscript,
        keywords: ['deployment', 'incident', 'line', 'deploy.ts'],
        recencyRank: 2,
        tokenEstimate: { l0: 80, l1: 300, l2: 3000 }
      }
    ])

    const retriever = new LayeredContextRetriever(storage)
    const budget = 420
    const result = await retriever.retrieve(index, 'exact error line in deploy.ts', {
      ...DEFAULT_LAYERED_CONTEXT_CONFIG,
      maxPromptTokens: budget,
      retrievalEscalationThresholds: {
        ...DEFAULT_LAYERED_CONTEXT_CONFIG.retrievalEscalationThresholds,
        maxItemsForL2: 2
      }
    })

    assert.ok(result.tokenUsage.total <= budget)
  } finally {
    await cleanup()
  }
})
