import type {
  CaseEvaluationResult,
  ContextEvalSummary,
  DeltaWithConfidenceInterval,
  DistributionStats,
  EvalRunnerConfig,
  EvidenceScore
} from './types'

function normalizeForMatch(input: string): string {
  return input.toLowerCase().replace(/\s+/g, ' ').trim()
}

function createSeededRng(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let value = Math.imul(state ^ (state >>> 15), 1 | state)
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

function percentile(values: number[], ratio: number): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * ratio)))
  return sorted[index]
}

function mean(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function rateFromBools(values: Array<boolean | null>): number | null {
  const mapped = values.filter((value): value is boolean => value !== null)
  if (mapped.length === 0) return null
  const positives = mapped.filter((value) => value).length
  return positives / mapped.length
}

export function computeDistribution(values: number[]): DistributionStats {
  if (values.length === 0) {
    return { mean: 0, p50: 0, p95: 0, min: 0, max: 0 }
  }

  return {
    mean: mean(values),
    p50: percentile(values, 0.5),
    p95: percentile(values, 0.95),
    min: Math.min(...values),
    max: Math.max(...values)
  }
}

export function computeDeltaWithConfidenceInterval(deltas: number[]): DeltaWithConfidenceInterval | null {
  if (deltas.length === 0) return null

  const bootstrapIterations = Math.max(600, Math.min(3000, deltas.length * 60))
  const sampleMeans: number[] = []
  const rng = createSeededRng(42)

  for (let i = 0; i < bootstrapIterations; i++) {
    let sum = 0
    for (let j = 0; j < deltas.length; j++) {
      const index = Math.floor(rng() * deltas.length)
      sum += deltas[index]
    }
    sampleMeans.push(sum / deltas.length)
  }

  sampleMeans.sort((a, b) => a - b)
  const lowerIndex = Math.floor(sampleMeans.length * 0.025)
  const upperIndex = Math.floor(sampleMeans.length * 0.975)

  return {
    mean: mean(deltas),
    lower95: sampleMeans[lowerIndex] ?? 0,
    upper95: sampleMeans[upperIndex] ?? 0,
    sampleCount: deltas.length
  }
}

export function scoreEvidenceCoverage(contextText: string, expectedEvidence: string[]): EvidenceScore {
  if (expectedEvidence.length === 0) {
    return {
      recall: 1,
      hitEvidence: [],
      missingEvidence: []
    }
  }

  const normalizedContext = normalizeForMatch(contextText)
  const hitEvidence: string[] = []
  const missingEvidence: string[] = []

  for (const evidence of expectedEvidence) {
    const normalizedEvidence = normalizeForMatch(evidence)
    if (!normalizedEvidence) continue
    if (normalizedContext.includes(normalizedEvidence)) {
      hitEvidence.push(evidence)
    } else {
      missingEvidence.push(evidence)
    }
  }

  const denominator = expectedEvidence.length
  const recall = denominator > 0 ? hitEvidence.length / denominator : 1
  return { recall, hitEvidence, missingEvidence }
}

export function summarizeResults(
  results: CaseEvaluationResult[],
  config: EvalRunnerConfig
): ContextEvalSummary {
  const baselineTokens = results.map((item) => item.baseline.promptTokens)
  const candidateTokens = results.map((item) => item.candidate.promptTokens)
  const savingsRatios = results.map((item) => item.promptTokenSavingsRatio)
  const appliedResults = results.filter((item) => item.candidate.layeredApplied)
  const appliedBaselineTokens = appliedResults.map((item) => item.baseline.promptTokens)
  const appliedCandidateTokens = appliedResults.map((item) => item.candidate.promptTokens)
  const appliedSavingsRatios = appliedResults.map((item) => item.promptTokenSavingsRatio)

  const baselineEvidence = results
    .map((item) => item.baseline.evidenceScore?.recall ?? null)
    .filter((value): value is number => value !== null)
  const candidateEvidence = results
    .map((item) => item.candidate.evidenceScore?.recall ?? null)
    .filter((value): value is number => value !== null)
  const evidenceDeltas = results
    .map((item) => item.evidenceRecallDelta)
    .filter((value): value is number => value !== null)

  const layerAdequacyRate = rateFromBools(results.map((item) => item.layerAdequacyPass))
  const informationLossRate = rateFromBools(results.map((item) => item.informationLossIncident))

  const regressionCases = results.filter((item) => {
    const qualityDrop = (item.evidenceRecallDelta ?? 0) < 0
    const tokenRegression = item.promptTokenSavingsRatio < 0
    const layerFailure = item.layerAdequacyPass === false
    const infoLoss = item.informationLossIncident === true
    return qualityDrop || tokenRegression || layerFailure || infoLoss
  }).length

  return {
    runId: config.runId,
    generatedAt: new Date().toISOString(),
    datasetPath: config.datasetPath,
    outputDir: config.outputDir,
    caseCount: results.length,
    config: {
      maxCases: config.maxCases,
      layeredConfig: config.layeredConfig
    },
    metrics: {
      promptTokens: {
        baseline: computeDistribution(baselineTokens),
        candidate: computeDistribution(candidateTokens),
        savingsRatio: computeDistribution(savingsRatios)
      },
      evidenceRecall: {
        baseline: baselineEvidence.length > 0 ? computeDistribution(baselineEvidence) : null,
        candidate: candidateEvidence.length > 0 ? computeDistribution(candidateEvidence) : null,
        delta: computeDeltaWithConfidenceInterval(evidenceDeltas)
      },
      layerAdequacyRate,
      informationLossRate,
      regressionCases,
      stableOrImprovedCases: Math.max(0, results.length - regressionCases),
      layeredApplication: {
        appliedCaseCount: appliedResults.length,
        applyRate: results.length > 0 ? appliedResults.length / results.length : 0,
        promptTokensWhenApplied:
          appliedResults.length > 0
            ? {
                baseline: computeDistribution(appliedBaselineTokens),
                candidate: computeDistribution(appliedCandidateTokens),
                savingsRatio: computeDistribution(appliedSavingsRatios)
              }
            : null
      }
    }
  }
}

