import test from 'node:test'
import assert from 'node:assert/strict'
import { LayeredSummaryGenerator, type LlmSummaryProvider } from '../../src/main/services/agent/context/layered/summarizer'

test('summary generation falls back when llm summary fails', async () => {
  const failingProvider: LlmSummaryProvider = {
    async summarize() {
      throw new Error('simulated provider error')
    }
  }

  const generator = new LayeredSummaryGenerator(failingProvider)
  const source = `
USER: We need to ship release 1.0.
ASSISTANT: I prepared a checklist for rollout and rollback.
USER: Please include database migration notes and health checks.
  `

  const overview = await generator.generateOverview(source, 500)
  assert.equal(overview.fallbackUsed, true)
  assert.match(overview.fallbackReason ?? '', /overview_llm_failed/)
  assert.ok(overview.text.length > 0)

  const abstract = await generator.generateAbstract(overview.text, 120)
  assert.equal(abstract.fallbackUsed, true)
  assert.match(abstract.fallbackReason ?? '', /abstract_llm_failed/)
  assert.ok(abstract.text.length > 0)
})
