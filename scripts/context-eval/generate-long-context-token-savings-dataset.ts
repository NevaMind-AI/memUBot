import fs from 'node:fs/promises'
import path from 'node:path'
import { loadDataset } from './dataset'
import type Anthropic from '@anthropic-ai/sdk'

interface GeneratorCliOptions {
  templatePath: string
  outputPath: string
  count: number
  historyRounds: number
}

interface GeneratedCase {
  id: string
  platform: string
  chatId: string | null
  query: string
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
  labels?: {
    expectedEvidence?: string[]
    expectedLayerMin?: 'L0' | 'L1' | 'L2'
    referenceAnswer?: string
    tags?: string[]
  }
  metadata: {
    sourceTemplateId: string
    sampleIndex: number
    generatedBy: string
    historyRounds: number
    messageCount: number
    domain: 'deployment' | 'billing' | 'onboarding'
  }
}

type DomainKind = 'deployment' | 'billing' | 'onboarding'

const DEFAULT_TEMPLATE_PATH = 'tests/layered-context/datasets/context-eval.template.jsonl'
const DEFAULT_OUTPUT_PATH = 'tests/layered-context/datasets/context-eval.long-context-token-savings.large-1000.jsonl'
const DEFAULT_COUNT = 1000
const DEFAULT_HISTORY_ROUNDS = 28

const QUERY_SUFFIXES = [
  'Keep the response evidence-oriented.',
  'Prefer concise bullets with concrete artifacts.',
  'Highlight operational risk before recommendations.',
  'Keep trade-offs explicit and actionable.'
]

const DEPLOYMENT_USER_TOPICS = [
  'canary traffic progression and rollback safety gate',
  'deploy.ts release gate timeout handling',
  'postmortem evidence collection and owner assignment',
  'health probe thresholds before traffic expansion',
  'incident timeline checkpoints and mitigation logs'
]

const DEPLOYMENT_ASSISTANT_TOPICS = [
  'captured rollback command rehearsals and dry-run notes',
  'recorded stack traces around validateReleaseGate failures',
  'updated rollout checklist with stricter canary checks',
  'tracked risk register entries for deployment blockers',
  'summarized recovery path with verification checkpoints'
]

const BILLING_USER_TOPICS = [
  'invoice retry schedule and dead-letter policy',
  'duplicate charge prevention during migration cutover',
  'reconciliation checkpoint ownership across services',
  'failed payment alert threshold tuning',
  'migration readiness criteria for final switchover'
]

const BILLING_ASSISTANT_TOPICS = [
  'documented idempotency key strategy and settlement guards',
  'captured reconciliation latency risks and mitigations',
  'updated migration checkpoints for traffic shadow and cutover',
  'summarized support playbook for duplicate charge incidents',
  'tracked rollback-safe migration controls for payment rails'
]

const ONBOARDING_USER_TOPICS = [
  'module boundaries between intake and policy engine',
  'ownership model for profile enrichment dependencies',
  'event handoff contract for onboarding_events topic',
  'compliance gate ordering before enrichment pipeline',
  'latency budget and false-positive risk constraints'
]

const ONBOARDING_ASSISTANT_TOPICS = [
  'mapped architecture flow across intake policy enrichment and notification modules',
  'captured boundary violations and refactor candidates',
  'recorded interface contracts and escalation ownership',
  'updated rollout constraints for onboarding quality goals',
  'summarized dependency graph and coupling hotspots'
]

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return parsed
}

function parseArgs(argv: string[]): GeneratorCliOptions {
  const args = [...argv]
  let templatePath = DEFAULT_TEMPLATE_PATH
  let outputPath = DEFAULT_OUTPUT_PATH
  let count = DEFAULT_COUNT
  let historyRounds = DEFAULT_HISTORY_ROUNDS

  for (let i = 0; i < args.length; i++) {
    const token = args[i]
    if (token === '--template' && i + 1 < args.length) {
      templatePath = args[++i]
      continue
    }
    if (token === '--output' && i + 1 < args.length) {
      outputPath = args[++i]
      continue
    }
    if (token === '--count' && i + 1 < args.length) {
      count = parsePositiveInt(args[++i], DEFAULT_COUNT)
      continue
    }
    if (token === '--history-rounds' && i + 1 < args.length) {
      historyRounds = parsePositiveInt(args[++i], DEFAULT_HISTORY_ROUNDS)
      continue
    }
  }

  return { templatePath, outputPath, count, historyRounds }
}

function pickBySeed(values: string[], seed: number, offset: number): string {
  return values[(seed + offset) % values.length]
}

function inferDomain(templateId: string, expectedLayerMin?: string): DomainKind {
  if (templateId.includes('deploy') || expectedLayerMin === 'L2') return 'deployment'
  if (templateId.includes('billing') || expectedLayerMin === 'L0') return 'billing'
  return 'onboarding'
}

function buildRoundMessages(
  domain: DomainKind,
  roundIndex: number,
  sampleIndex: number
): Array<{ role: 'user' | 'assistant'; content: string }> {
  const seed = sampleIndex * 997 + roundIndex * 131
  const artifactId = `${sampleIndex + 1}-${roundIndex + 1}`

  if (domain === 'deployment') {
    const userTopic = pickBySeed(DEPLOYMENT_USER_TOPICS, seed, 0)
    const assistantTopic = pickBySeed(DEPLOYMENT_ASSISTANT_TOPICS, seed, 1)
    return [
      {
        role: 'user',
        content: `Deployment cycle ${artifactId}: review ${userTopic} with evidence from canary rollout telemetry and release gate logs.`
      },
      {
        role: 'assistant',
        content: `Recorded deployment cycle ${artifactId}: ${assistantTopic}. Added checklist traceability for rollback validation and incident recovery.`
      }
    ]
  }

  if (domain === 'billing') {
    const userTopic = pickBySeed(BILLING_USER_TOPICS, seed, 0)
    const assistantTopic = pickBySeed(BILLING_ASSISTANT_TOPICS, seed, 2)
    return [
      {
        role: 'user',
        content: `Billing migration run ${artifactId}: verify ${userTopic} and annotate payment processor risk checkpoints for audit review.`
      },
      {
        role: 'assistant',
        content: `Captured billing run ${artifactId}: ${assistantTopic}. Added action items for retry reliability and reconciliation confidence.`
      }
    ]
  }

  const userTopic = pickBySeed(ONBOARDING_USER_TOPICS, seed, 0)
  const assistantTopic = pickBySeed(ONBOARDING_ASSISTANT_TOPICS, seed, 3)
  return [
    {
      role: 'user',
      content: `Onboarding architecture pass ${artifactId}: inspect ${userTopic} and note interface assumptions for handoff resilience.`
    },
    {
      role: 'assistant',
      content: `Logged onboarding pass ${artifactId}: ${assistantTopic}. Updated module notes with ownership and risk prioritization.`
    }
  ]
}

function normalizeTemplateMessages(messages: Anthropic.MessageParam[]): Array<{ role: 'user' | 'assistant'; content: string }> {
  return messages
    .map((message) => {
      if (typeof message.content !== 'string') return null
      return {
        role: message.role as 'user' | 'assistant',
        content: message.content
      }
    })
    .filter((message): message is { role: 'user' | 'assistant'; content: string } => Boolean(message))
}

function buildLongHistory(
  domain: DomainKind,
  sampleIndex: number,
  rounds: number,
  templateMessages: Array<{ role: 'user' | 'assistant'; content: string }>
): Array<{ role: 'user' | 'assistant'; content: string }> {
  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = []

  for (let round = 0; round < rounds; round++) {
    messages.push(...buildRoundMessages(domain, round, sampleIndex))
  }

  // Keep an anchor section from template examples for continuity and evidence phrases.
  const anchorTail = templateMessages.slice(0, Math.min(templateMessages.length, 12))
  messages.push(...anchorTail)
  return messages
}

function buildQuery(baseQuery: string, sampleIndex: number): string {
  const suffix = QUERY_SUFFIXES[sampleIndex % QUERY_SUFFIXES.length]
  return `${baseQuery} Batch ${sampleIndex + 1}. ${suffix}`
}

function mergeTags(existingTags: string[] | undefined): string[] {
  const tagSet = new Set<string>(existingTags ?? [])
  tagSet.add('long-context')
  tagSet.add('token-savings')
  tagSet.add('generated')
  return [...tagSet]
}

async function run(): Promise<void> {
  const options = parseArgs(process.argv.slice(2))
  const templateAbsolutePath = path.resolve(options.templatePath)
  const outputAbsolutePath = path.resolve(options.outputPath)
  const templateCases = await loadDataset(templateAbsolutePath)

  if (templateCases.length === 0) {
    throw new Error('Template dataset is empty.')
  }

  const generatedCases: GeneratedCase[] = []
  for (let i = 0; i < options.count; i++) {
    const template = templateCases[i % templateCases.length]
    const expectedLayerMin = template.labels.expectedLayerMin
    const domain = inferDomain(template.id, expectedLayerMin)
    const normalizedMessages = normalizeTemplateMessages(template.messages)
    const longMessages = buildLongHistory(domain, i, options.historyRounds, normalizedMessages)
    const tags = mergeTags(template.labels.tags)

    generatedCases.push({
      id: `${template.id}-long-${String(i + 1).padStart(4, '0')}`,
      platform: template.platform,
      chatId: template.chatId,
      query: buildQuery(template.query, i),
      messages: longMessages,
      labels: {
        expectedEvidence: template.labels.expectedEvidence,
        expectedLayerMin: template.labels.expectedLayerMin,
        referenceAnswer: template.labels.referenceAnswer,
        tags
      },
      metadata: {
        sourceTemplateId: template.id,
        sampleIndex: i + 1,
        generatedBy: 'scripts/context-eval/generate-long-context-token-savings-dataset.ts',
        historyRounds: options.historyRounds,
        messageCount: longMessages.length,
        domain
      }
    })
  }

  await fs.mkdir(path.dirname(outputAbsolutePath), { recursive: true })
  const jsonl = `${generatedCases.map((entry) => JSON.stringify(entry)).join('\n')}\n`
  await fs.writeFile(outputAbsolutePath, jsonl, 'utf-8')

  console.log(
    '[GenerateLongContextDataset]',
    JSON.stringify(
      {
        templatePath: templateAbsolutePath,
        outputPath: outputAbsolutePath,
        generatedCases: generatedCases.length,
        historyRounds: options.historyRounds
      },
      null,
      2
    )
  )
}

run().catch((error) => {
  console.error('[GenerateLongContextDataset] failed:', error)
  process.exit(1)
})
