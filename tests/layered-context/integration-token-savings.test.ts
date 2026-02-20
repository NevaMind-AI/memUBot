import test from 'node:test'
import assert from 'node:assert/strict'
import type Anthropic from '@anthropic-ai/sdk'
import { LayeredContextIndexer } from '../../src/main/services/agent/context/layered/indexer'
import { LayeredContextManager } from '../../src/main/services/agent/context/layered/manager'
import { LayeredContextRetriever } from '../../src/main/services/agent/context/layered/retriever'
import { LayeredSummaryGenerator } from '../../src/main/services/agent/context/layered/summarizer'
import { DEFAULT_LAYERED_CONTEXT_CONFIG } from '../../src/main/services/agent/context/layered/config'
import { createLayeredTestDenseScoreProvider, createTempStorage } from './helpers'
import { estimateTokens } from '../../src/main/services/agent/context/token-estimator'

interface SavingsScenario {
  name: string
  query: string
  expectLayer?: 'L0' | 'L1' | 'L2'
}

interface ScenarioSample {
  name: string
  reachedLayer: 'L0' | 'L1' | 'L2'
  retrievalSavingsTokens: number
  retrievalSavingsRatio: number
  promptSavingsTokens: number
  promptSavingsRatio: number
  promptBefore: number
  promptAfter: number
}

function sumMessageTokens(messages: Anthropic.MessageParam[]): number {
  return messages.reduce((sum, message) => sum + estimateTokens(message), 0)
}

function buildTopicRounds(topic: 'deployment' | 'billing' | 'infra', rounds: number, seed: number): Anthropic.MessageParam[] {
  const messages: Anthropic.MessageParam[] = []
  for (let i = 0; i < rounds; i++) {
    const idx = seed + i
    if (topic === 'deployment') {
      messages.push({
        role: 'user',
        content:
          `Deployment checklist item ${idx}: verify rollout gates, rollback command, deploy.ts health checks, and canary status.`
      })
      messages.push({
        role: 'assistant',
        content:
          `Logged deployment readiness ${idx}. Captured release checklist evidence, rollback sequence, and incident prevention controls.`
      })
      continue
    }

    if (topic === 'billing') {
      messages.push({
        role: 'user',
        content:
          `Billing migration item ${idx}: validate invoice retry policy, duplicate charge prevention, and reconciliation checkpoints.`
      })
      messages.push({
        role: 'assistant',
        content:
          `Recorded billing migration ${idx}. Added invoice retry safeguards, settlement checks, and alerting scope.`
      })
      continue
    }

    messages.push({
      role: 'user',
      content:
        `Infrastructure ops task ${idx}: confirm backup windows, restore verification, and infra maintenance handoff rules.`
    })
    messages.push({
      role: 'assistant',
      content:
        `Captured infra operations ${idx}. Backup integrity, restore drill outcomes, and maintenance ownership are documented.`
    })
  }

  return messages
}

function buildConversationHistory(query: string): Anthropic.MessageParam[] {
  const messages: Anthropic.MessageParam[] = []
  messages.push(...buildTopicRounds('deployment', 8, 0))
  messages.push(...buildTopicRounds('billing', 8, 100))
  messages.push(...buildTopicRounds('infra', 8, 200))

  messages.push({
    role: 'user',
    content: query
  })

  return messages
}

test('layered strategy reports consistent token savings across query modes', async () => {
  const { storage, cleanup } = await createTempStorage()
  try {
    const summaryGenerator = new LayeredSummaryGenerator()
    const indexer = new LayeredContextIndexer(storage, summaryGenerator)
    const retriever = new LayeredContextRetriever(storage, createLayeredTestDenseScoreProvider())
    const manager = new LayeredContextManager(storage, indexer, retriever)

    const scenarios: SavingsScenario[] = [
      {
        name: 'broad-deployment',
        query: 'deployment release checklist rollback status'
      },
      {
        name: 'structured-billing',
        query: 'billing migration overview and architecture flow'
      },
      {
        name: 'precise-deployment-evidence',
        query: 'what is the exact error line in deploy.ts during rollout',
        expectLayer: 'L2'
      }
    ]

    const config = {
      ...DEFAULT_LAYERED_CONTEXT_CONFIG,
      maxPromptTokens: 2800,
      maxRecentMessages: 8,
      maxArchives: 10,
      archiveChunkSize: 8
    }

    const samples: ScenarioSample[] = []
    for (const scenario of scenarios) {
      const messages = buildConversationHistory(scenario.query)
      const promptBefore = sumMessageTokens(messages)

      const result = await manager.apply({
        sessionKey: `telegram:integration:${scenario.name}`,
        platform: 'telegram',
        chatId: null,
        query: scenario.query,
        messages,
        config
      })

      assert.equal(result.applied, true)
      assert.ok(result.retrieval)

      const retrieval = result.retrieval!
      if (scenario.expectLayer) {
        assert.equal(retrieval.decision.reachedLayer, scenario.expectLayer)
      }

      const promptAfter = sumMessageTokens(result.updatedMessages)
      const promptSavingsTokens = promptBefore - promptAfter
      const promptSavingsRatio = promptBefore > 0 ? promptSavingsTokens / promptBefore : 0

      assert.ok(retrieval.tokenUsage.savings > 0)
      assert.ok(promptSavingsTokens > 0)

      samples.push({
        name: scenario.name,
        reachedLayer: retrieval.decision.reachedLayer,
        retrievalSavingsTokens: retrieval.tokenUsage.savings,
        retrievalSavingsRatio: retrieval.tokenUsage.savingsRatio,
        promptSavingsTokens,
        promptSavingsRatio,
        promptBefore,
        promptAfter
      })
    }

    const avgPromptSavingsRatio =
      samples.reduce((sum, sample) => sum + sample.promptSavingsRatio, 0) / samples.length
    const avgRetrievalSavingsRatio =
      samples.reduce((sum, sample) => sum + sample.retrievalSavingsRatio, 0) / samples.length

    const report = {
      scenarios: samples.map((sample) => ({
        name: sample.name,
        reachedLayer: sample.reachedLayer,
        retrievalSavingsTokens: sample.retrievalSavingsTokens,
        retrievalSavingsRatio: Number((sample.retrievalSavingsRatio * 100).toFixed(1)),
        promptSavingsTokens: sample.promptSavingsTokens,
        promptSavingsRatio: Number((sample.promptSavingsRatio * 100).toFixed(1)),
        promptBefore: sample.promptBefore,
        promptAfter: sample.promptAfter
      })),
      avgRetrievalSavingsRatio: Number((avgRetrievalSavingsRatio * 100).toFixed(1)),
      avgPromptSavingsRatio: Number((avgPromptSavingsRatio * 100).toFixed(1))
    }

    console.log('[LayeredSavingsReport]', JSON.stringify(report, null, 2))

    assert.ok(avgRetrievalSavingsRatio > 0.25)
    assert.ok(avgPromptSavingsRatio > 0.35)
  } finally {
    await cleanup()
  }
})
