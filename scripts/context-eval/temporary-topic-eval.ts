import path from 'node:path'
import { loadDataset } from './dataset'
import {
  buildTopicReference,
  decideTemporaryTopicTransition,
  createLLMTopicScorer,
  createLLMTopicClassifier
} from '../../src/main/services/agent/context/layered/temporary-topic'

type TopicMode = 'MAIN' | 'TEMP'
type TransitionDecision = 'stay-main' | 'enter-temp' | 'stay-temp' | 'replace-temp' | 'exit-temp'

interface EvalCliOptions {
  datasetPath: string
  minAccuracy: number | null
  maxMismatches: number
  apiKey: string
  model?: string
  maxTokens?: number
  useClassifier: boolean
}

interface ConfusionCell {
  expected: TransitionDecision
  predicted: TransitionDecision
  count: number
}

interface MismatchSample {
  caseId: string
  stateBefore: TopicMode
  expected: TransitionDecision
  predicted: TransitionDecision
  relMain: number
  relTemp: number
  query: string
}

const DEFAULT_DATASET_PATH = 'tests/layered-context/datasets/context-eval.temporary-topic.large-1000.jsonl'
const DEFAULT_MAX_MISMATCHES = 20

const DECISIONS: TransitionDecision[] = ['stay-main', 'enter-temp', 'stay-temp', 'replace-temp', 'exit-temp']

function isTopicMode(value: unknown): value is TopicMode {
  return value === 'MAIN' || value === 'TEMP'
}

function isTransitionDecision(value: unknown): value is TransitionDecision {
  return typeof value === 'string' && DECISIONS.includes(value as TransitionDecision)
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return parsed
}

function parseMinAccuracy(value: string | undefined): number | null {
  if (!value) return null
  const parsed = Number.parseFloat(value)
  if (!Number.isFinite(parsed)) return null
  if (parsed < 0 || parsed > 1) return null
  return parsed
}

function parseArgs(argv: string[]): EvalCliOptions {
  const args = [...argv]
  let datasetPath = DEFAULT_DATASET_PATH
  let minAccuracy: number | null = null
  let maxMismatches = DEFAULT_MAX_MISMATCHES
  let apiKey = process.env.MEMU_API_KEY ?? ''
  let model: string | undefined
  let maxTokens: number | undefined
  let useClassifier = false

  for (let i = 0; i < args.length; i++) {
    const token = args[i]
    if (token === '--dataset' && i + 1 < args.length) {
      datasetPath = args[++i]
      continue
    }
    if (token === '--min-accuracy' && i + 1 < args.length) {
      minAccuracy = parseMinAccuracy(args[++i])
      continue
    }
    if (token === '--max-mismatches' && i + 1 < args.length) {
      maxMismatches = parsePositiveInt(args[++i], DEFAULT_MAX_MISMATCHES)
      continue
    }
    if (token === '--api-key' && i + 1 < args.length) {
      apiKey = args[++i]
      continue
    }
    if (token === '--model' && i + 1 < args.length) {
      model = args[++i]
      continue
    }
    if (token === '--max-tokens' && i + 1 < args.length) {
      const parsed = Number.parseInt(args[++i], 10)
      if (Number.isFinite(parsed) && parsed > 0) maxTokens = parsed
      continue
    }
    if (token === '--classifier') {
      useClassifier = true
      continue
    }
  }

  if (!apiKey) {
    throw new Error('API key required. Set MEMU_API_KEY env var or pass --api-key <key>.')
  }

  return {
    datasetPath,
    minAccuracy,
    maxMismatches,
    apiKey,
    model,
    maxTokens,
    useClassifier
  }
}

function buildConfusionTemplate(): Record<TransitionDecision, Record<TransitionDecision, number>> {
  const matrix = {} as Record<TransitionDecision, Record<TransitionDecision, number>>
  for (const expected of DECISIONS) {
    matrix[expected] = {} as Record<TransitionDecision, number>
    for (const predicted of DECISIONS) {
      matrix[expected][predicted] = 0
    }
  }
  return matrix
}

function toSortedCells(matrix: Record<TransitionDecision, Record<TransitionDecision, number>>): ConfusionCell[] {
  const cells: ConfusionCell[] = []
  for (const expected of DECISIONS) {
    for (const predicted of DECISIONS) {
      const count = matrix[expected][predicted]
      if (count <= 0) continue
      cells.push({ expected, predicted, count })
    }
  }
  cells.sort((a, b) => b.count - a.count)
  return cells
}

async function run(): Promise<void> {
  const options = parseArgs(process.argv.slice(2))
  const datasetAbsolutePath = path.resolve(options.datasetPath)
  const cases = await loadDataset(datasetAbsolutePath)

  const scorerOptions = {
    apiKey: options.apiKey,
    model: options.model,
    maxTokens: options.maxTokens
  }
  const scorer = options.useClassifier
    ? createLLMTopicClassifier(scorerOptions)
    : createLLMTopicScorer(scorerOptions)

  const confusion = buildConfusionTemplate()
  const expectedCounts = {} as Record<TransitionDecision, number>
  const matchedCounts = {} as Record<TransitionDecision, number>
  for (const decision of DECISIONS) {
    expectedCounts[decision] = 0
    matchedCounts[decision] = 0
  }

  const mismatches: MismatchSample[] = []
  let evaluatedCases = 0
  let skippedCases = 0
  let matchedCases = 0

  for (const entry of cases) {
    const stateBefore = entry.metadata?.stateBefore
    const expectedTransition = entry.metadata?.expectedTransition
    if (!isTopicMode(stateBefore) || !isTransitionDecision(expectedTransition)) {
      skippedCases++
      continue
    }

    const mainTopicReference =
      stateBefore === 'MAIN'
        ? buildTopicReference(entry.messages)
        : typeof entry.metadata?.frozenMainReference === 'string'
          ? entry.metadata.frozenMainReference
          : ''
    const tempTopicReference = stateBefore === 'TEMP' ? buildTopicReference(entry.messages) : ''

    const result = await decideTemporaryTopicTransition({
      mode: stateBefore,
      query: entry.query,
      mainTopicReference,
      tempTopicReference
    }, scorer)

    evaluatedCases++
    expectedCounts[expectedTransition]++
    confusion[expectedTransition][result.decision]++

    if (result.decision === expectedTransition) {
      matchedCases++
      matchedCounts[expectedTransition]++
      continue
    }

    if (mismatches.length < options.maxMismatches) {
      mismatches.push({
        caseId: entry.id,
        stateBefore,
        expected: expectedTransition,
        predicted: result.decision,
        relMain: Number(result.relMain.toFixed(3)),
        relTemp: Number(result.relTemp.toFixed(3)),
        query: entry.query
      })
    }
  }

  const accuracy = evaluatedCases > 0 ? matchedCases / evaluatedCases : 0
  const perTransitionRecall = {} as Record<TransitionDecision, number>
  for (const decision of DECISIONS) {
    const total = expectedCounts[decision]
    perTransitionRecall[decision] = total > 0 ? matchedCounts[decision] / total : 0
  }

  const summary = {
    datasetPath: datasetAbsolutePath,
    datasetCases: cases.length,
    evaluatedCases,
    skippedCases,
    matchedCases,
    accuracy: Number(accuracy.toFixed(4)),
    expectedCounts,
    perTransitionRecall,
    confusionTopCells: toSortedCells(confusion).slice(0, 15),
    mismatches
  }

  console.log('[TemporaryTopicEval]', JSON.stringify(summary, null, 2))

  if (options.minAccuracy !== null && accuracy < options.minAccuracy) {
    console.error(
      `[TemporaryTopicEval] accuracy ${accuracy.toFixed(4)} is below threshold ${options.minAccuracy.toFixed(4)}`
    )
    process.exitCode = 1
  }
}

run().catch((error) => {
  console.error('[TemporaryTopicEval] failed:', error)
  process.exit(1)
})
