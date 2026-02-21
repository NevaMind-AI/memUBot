import test from 'node:test'
import assert from 'node:assert/strict'
import type Anthropic from '@anthropic-ai/sdk'
import {
  buildTopicReference,
  decideTemporaryTopicTransition,
  DEFAULT_TEMPORARY_TOPIC_THRESHOLDS,
  type TopicScorer,
  type TopicRelevanceScores
} from '../../src/main/services/agent/context/layered/temporary-topic'

function createMockScorer(scores: TopicRelevanceScores): TopicScorer {
  return async () => scores
}

test('enters temporary topic when relMain is below enterThreshold', async () => {
  const scorer = createMockScorer({ relMain: 0.2, relTemp: 0 })
  const result = await decideTemporaryTopicTransition({
    mode: 'MAIN',
    query: 'how to validate invoice retry behavior for billing migration',
    mainTopicReference: 'Deployment rollout checklist, rollback command.'
  }, scorer)

  assert.equal(result.decision, 'enter-temp')
  assert.ok(result.relMain < DEFAULT_TEMPORARY_TOPIC_THRESHOLDS.enterThreshold)
})

test('stays in main topic when relMain is above enterThreshold', async () => {
  const scorer = createMockScorer({ relMain: 0.8, relTemp: 0 })
  const result = await decideTemporaryTopicTransition({
    mode: 'MAIN',
    query: 'show deployment rollout checklist and rollback status',
    mainTopicReference: 'Deployment rollout checklist, rollback command.'
  }, scorer)

  assert.equal(result.decision, 'stay-main')
  assert.ok(result.relMain >= DEFAULT_TEMPORARY_TOPIC_THRESHOLDS.enterThreshold)
})

test('exits temporary topic when relMain is high and relTemp is low', async () => {
  const scorer = createMockScorer({ relMain: 0.75, relTemp: 0.3 })
  const result = await decideTemporaryTopicTransition({
    mode: 'TEMP',
    query: 'continue deployment rollback and canary investigation',
    mainTopicReference: 'Deployment rollout checklist, rollback command.',
    tempTopicReference: 'Billing migration invoice retry policy.'
  }, scorer)

  assert.equal(result.decision, 'exit-temp')
  assert.ok(result.relMain > DEFAULT_TEMPORARY_TOPIC_THRESHOLDS.exitThreshold)
  assert.ok(result.relTemp < DEFAULT_TEMPORARY_TOPIC_THRESHOLDS.tempStayThreshold)
})

test('replaces temporary topic when both relMain and relTemp are low', async () => {
  const scorer = createMockScorer({ relMain: 0.2, relTemp: 0.3 })
  const result = await decideTemporaryTopicTransition({
    mode: 'TEMP',
    query: 'draft interview loop and candidate scorecard template',
    mainTopicReference: 'Deployment rollout checklist, rollback command.',
    tempTopicReference: 'Billing migration invoice retry policy.'
  }, scorer)

  assert.equal(result.decision, 'replace-temp')
  assert.ok(result.relMain < DEFAULT_TEMPORARY_TOPIC_THRESHOLDS.enterThreshold)
  assert.ok(result.relTemp < DEFAULT_TEMPORARY_TOPIC_THRESHOLDS.tempStayThreshold)
})

test('stays in temporary topic when relTemp is high', async () => {
  const scorer = createMockScorer({ relMain: 0.3, relTemp: 0.9 })
  const result = await decideTemporaryTopicTransition({
    mode: 'TEMP',
    query: 'explain duplicate charge prevention for billing invoices',
    mainTopicReference: 'Deployment rollout checklist, rollback command.',
    tempTopicReference: 'Billing migration invoice retry policy.'
  }, scorer)

  assert.equal(result.decision, 'stay-temp')
  assert.ok(result.relTemp >= DEFAULT_TEMPORARY_TOPIC_THRESHOLDS.tempStayThreshold)
})

test('stays in main when query is empty', async () => {
  const scorer = createMockScorer({ relMain: 0, relTemp: 0 })
  const result = await decideTemporaryTopicTransition({
    mode: 'MAIN',
    query: '',
    mainTopicReference: 'Some topic.'
  }, scorer)

  assert.equal(result.decision, 'stay-main')
})

test('stays in temp when query is empty', async () => {
  const scorer = createMockScorer({ relMain: 0, relTemp: 0 })
  const result = await decideTemporaryTopicTransition({
    mode: 'TEMP',
    query: '',
    mainTopicReference: 'Some topic.',
    tempTopicReference: 'Temp topic.'
  }, scorer)

  assert.equal(result.decision, 'stay-temp')
})

test('buildTopicReference only keeps text content from messages', () => {
  const messages: Anthropic.MessageParam[] = [
    {
      role: 'user',
      content: 'Need deployment rollback checklist details.'
    },
    {
      role: 'assistant',
      content: [
        {
          type: 'text',
          text: 'Use deploy.ts rollback command and verify canary health checks.'
        },
        {
          type: 'tool_use',
          id: 'tool-1',
          name: 'file_read',
          input: { path: '/tmp/deploy.ts' }
        }
      ]
    },
    {
      role: 'user',
      content: [
        {
          type: 'tool_result',
          tool_use_id: 'tool-1',
          content: '{"heavy":"payload"}'
        }
      ]
    }
  ]

  const reference = buildTopicReference(messages)

  assert.match(reference, /deployment/i)
  assert.match(reference, /deploy\.ts/i)
  assert.doesNotMatch(reference, /heavy/)
})
