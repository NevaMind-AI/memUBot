import test from 'node:test'
import assert from 'node:assert/strict'
import { LayeredContextRetriever } from '../../src/main/services/agent/context/layered/retriever'
import { DEFAULT_LAYERED_CONTEXT_CONFIG } from '../../src/main/services/agent/context/layered/config'
import { createTempStorage, seedIndex } from './helpers'

test('retrieval stays at L0 when confidence is high for broad query', async () => {
  const { storage, cleanup } = await createTempStorage()
  try {
    const sessionKey = 'telegram:default'
    const index = await seedIndex(storage, sessionKey, [
      {
        id: 'deploy-node',
        abstract: 'Deployment checklist and release readiness summary.',
        overview: 'Discusses release gates, rollout steps, and rollback strategy for deployment.',
        transcript: 'release checklist rollout rollback deployment',
        keywords: ['deployment', 'release', 'checklist'],
        recencyRank: 1
      },
      {
        id: 'billing-node',
        abstract: 'Billing migration details for invoice processor.',
        overview: 'Mentions invoices, payment retries, and billing edge cases.',
        transcript: 'billing migration invoice retries edge-cases',
        keywords: ['billing', 'invoice', 'retry'],
        recencyRank: 2
      }
    ])

    const retriever = new LayeredContextRetriever(storage)
    const result = await retriever.retrieve(index, 'deployment release checklist status', {
      ...DEFAULT_LAYERED_CONTEXT_CONFIG,
      maxPromptTokens: 5000
    })

    assert.equal(result.decision.reachedLayer, 'L0')
    assert.ok(result.selections.some((item) => item.layer === 'L0' && item.nodeId === 'deploy-node'))
  } finally {
    await cleanup()
  }
})

test('retrieval escalates to L2 when query is precise', async () => {
  const { storage, cleanup } = await createTempStorage()
  try {
    const sessionKey = 'telegram:default'
    const index = await seedIndex(storage, sessionKey, [
      {
        id: 'deploy-node',
        abstract: 'Deployment incident summary.',
        overview: 'Contains deployment incident diagnosis and patch details.',
        transcript: 'Exact error line 42 in deploy.ts caused outage during canary.',
        keywords: ['deployment', 'incident', 'line', 'deploy.ts'],
        recencyRank: 1
      },
      {
        id: 'other-node',
        abstract: 'General onboarding summary.',
        overview: 'Generic onboarding notes unrelated to deployment.',
        transcript: 'onboarding notes and documentation',
        keywords: ['onboarding'],
        recencyRank: 2
      }
    ])

    const retriever = new LayeredContextRetriever(storage)
    const result = await retriever.retrieve(index, 'what is the exact error line in deploy.ts', {
      ...DEFAULT_LAYERED_CONTEXT_CONFIG,
      maxPromptTokens: 8000
    })

    assert.equal(result.decision.reachedLayer, 'L2')
    assert.ok(result.selections.some((item) => item.layer === 'L2' && item.nodeId === 'deploy-node'))
  } finally {
    await cleanup()
  }
})
