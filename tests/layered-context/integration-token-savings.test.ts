import test from 'node:test'
import assert from 'node:assert/strict'
import type Anthropic from '@anthropic-ai/sdk'
import { LayeredContextIndexer } from '../../src/main/services/agent/context/layered/indexer'
import { LayeredContextManager } from '../../src/main/services/agent/context/layered/manager'
import { LayeredContextRetriever } from '../../src/main/services/agent/context/layered/retriever'
import { LayeredSummaryGenerator } from '../../src/main/services/agent/context/layered/summarizer'
import { DEFAULT_LAYERED_CONTEXT_CONFIG } from '../../src/main/services/agent/context/layered/config'
import { createTempStorage } from './helpers'

function buildConversationHistory(): Anthropic.MessageParam[] {
  const messages: Anthropic.MessageParam[] = []
  for (let i = 0; i < 40; i++) {
    messages.push({
      role: 'user',
      content: `Release checklist item ${i}: verify health checks, rollback path, and deployment gates.`
    })
    messages.push({
      role: 'assistant',
      content: `Acknowledged checklist item ${i}. Captured risks and mitigation plans for rollout.`
    })
  }

  messages.push({
    role: 'user',
    content: 'Please provide an overview of release checklist and major risks.'
  })
  return messages
}

test('layered strategy reduces token usage against baseline L2 replay', async () => {
  const { storage, cleanup } = await createTempStorage()
  try {
    const summaryGenerator = new LayeredSummaryGenerator()
    const indexer = new LayeredContextIndexer(storage, summaryGenerator)
    const retriever = new LayeredContextRetriever(storage)
    const manager = new LayeredContextManager(storage, indexer, retriever)

    const config = {
      ...DEFAULT_LAYERED_CONTEXT_CONFIG,
      maxPromptTokens: 2500,
      maxRecentMessages: 8,
      maxArchives: 8,
      archiveChunkSize: 6
    }

    const messages = buildConversationHistory()
    const result = await manager.apply({
      sessionKey: 'telegram:integration',
      platform: 'telegram',
      chatId: null,
      query: 'release checklist overview',
      messages,
      config
    })

    assert.equal(result.applied, true)
    assert.ok(result.retrieval)
    assert.ok(result.retrieval!.tokenUsage.total < result.retrieval!.tokenUsage.baselineL2)
    assert.ok(result.retrieval!.tokenUsage.savings > 0)

    const hasQualitySignal = result.updatedMessages.some((message) => {
      if (typeof message.content !== 'string') return false
      return message.content.toLowerCase().includes('release checklist')
    })
    assert.equal(hasQualitySignal, true)
  } finally {
    await cleanup()
  }
})
