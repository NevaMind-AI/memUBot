import fs from 'node:fs/promises'
import path from 'node:path'
import type { ContextEvalSummary } from './types'

interface GateConfig {
  summaryPath: string
  minTokenSavings: number
  maxEvidenceRecallDrop: number
  maxInformationLossRate: number
  minLayerAdequacyRate: number
}

const DEFAULT_GATE_THRESHOLDS = {
  // Token-first target: enforce meaningful savings while preventing large quality regressions.
  minTokenSavings: 0.18,
  maxEvidenceRecallDrop: 0.03,
  maxInformationLossRate: 0.05,
  minLayerAdequacyRate: 0.8
} as const

function parseArgs(argv: string[]): Map<string, string> {
  const values = new Map<string, string>()
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i]
    if (!token.startsWith('--')) continue
    const key = token.slice(2)
    const next = argv[i + 1]
    if (!next || next.startsWith('--')) {
      values.set(key, 'true')
      continue
    }
    values.set(key, next)
    i++
  }
  return values
}

function resolvePath(input: string): string {
  if (path.isAbsolute(input)) return input
  return path.resolve(process.cwd(), input)
}

function parseNumber(input: string | undefined, fallback: number): number {
  if (!input) return fallback
  const parsed = Number.parseFloat(input)
  if (!Number.isFinite(parsed)) return fallback
  return parsed
}

async function resolveSummaryPath(args: Map<string, string>): Promise<string> {
  const directPath = args.get('summary')
  if (directPath) {
    return resolvePath(directPath)
  }

  const outputDir = resolvePath(args.get('outputDir') ?? 'reports/context-eval')
  const runId = args.get('runId')
  if (runId) {
    return path.join(outputDir, runId, 'summary.json')
  }

  const latestPointerPath = path.join(outputDir, 'latest.json')
  const pointerContent = await fs.readFile(latestPointerPath, 'utf-8')
  const pointer = JSON.parse(pointerContent) as { summaryJsonPath?: string }
  if (!pointer.summaryJsonPath) {
    throw new Error(`Latest pointer at "${latestPointerPath}" does not contain "summaryJsonPath".`)
  }

  return pointer.summaryJsonPath
}

function asPercent(value: number): string {
  return `${(value * 100).toFixed(2)}%`
}

async function loadSummary(summaryPath: string): Promise<ContextEvalSummary> {
  const content = await fs.readFile(summaryPath, 'utf-8')
  return JSON.parse(content) as ContextEvalSummary
}

function buildGateConfig(args: Map<string, string>, summaryPath: string): GateConfig {
  return {
    summaryPath,
    minTokenSavings: parseNumber(args.get('minTokenSavings'), DEFAULT_GATE_THRESHOLDS.minTokenSavings),
    maxEvidenceRecallDrop: parseNumber(args.get('maxEvidenceRecallDrop'), DEFAULT_GATE_THRESHOLDS.maxEvidenceRecallDrop),
    maxInformationLossRate: parseNumber(
      args.get('maxInformationLossRate'),
      DEFAULT_GATE_THRESHOLDS.maxInformationLossRate
    ),
    minLayerAdequacyRate: parseNumber(
      args.get('minLayerAdequacyRate'),
      DEFAULT_GATE_THRESHOLDS.minLayerAdequacyRate
    )
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))
  const summaryPath = await resolveSummaryPath(args)
  const summary = await loadSummary(summaryPath)
  const config = buildGateConfig(args, summaryPath)

  const savingsMean = summary.metrics.promptTokens.savingsRatio.mean
  const evidenceDeltaMean = summary.metrics.evidenceRecall.delta?.mean ?? 0
  const evidenceDeltaAvailable = summary.metrics.evidenceRecall.delta !== null
  const informationLossRate = summary.metrics.informationLossRate
  const layerAdequacyRate = summary.metrics.layerAdequacyRate

  const savingsPass = savingsMean >= config.minTokenSavings
  const evidencePass = evidenceDeltaAvailable ? evidenceDeltaMean >= -config.maxEvidenceRecallDrop : true
  const infoLossPass = informationLossRate === null ? true : informationLossRate <= config.maxInformationLossRate
  const layerAdequacyPass =
    layerAdequacyRate === null ? true : layerAdequacyRate >= config.minLayerAdequacyRate

  console.log(`[ContextEval:Gate] Summary: ${config.summaryPath}`)
  console.log(
    `[ContextEval:Gate] Token savings mean: ${asPercent(savingsMean)} (threshold >= ${asPercent(config.minTokenSavings)}) => ${
      savingsPass ? 'PASS' : 'FAIL'
    }`
  )
  console.log(
    `[ContextEval:Gate] Evidence recall delta mean: ${
      evidenceDeltaAvailable ? asPercent(evidenceDeltaMean) : 'n/a'
    } (threshold >= -${asPercent(config.maxEvidenceRecallDrop)}) => ${evidencePass ? 'PASS' : 'FAIL'}`
  )
  console.log(
    `[ContextEval:Gate] Information loss rate: ${
      informationLossRate === null ? 'n/a' : asPercent(informationLossRate)
    } (threshold <= ${asPercent(config.maxInformationLossRate)}) => ${infoLossPass ? 'PASS' : 'FAIL'}`
  )
  console.log(
    `[ContextEval:Gate] Layer adequacy rate: ${
      layerAdequacyRate === null ? 'n/a' : asPercent(layerAdequacyRate)
    } (threshold >= ${asPercent(config.minLayerAdequacyRate)}) => ${layerAdequacyPass ? 'PASS' : 'FAIL'}`
  )
  console.log(
    `[ContextEval:Gate] Layered apply rate: ${asPercent(summary.metrics.layeredApplication.applyRate)} ` +
      `(${summary.metrics.layeredApplication.appliedCaseCount}/${summary.caseCount}), ` +
      `applied-only savings: ${
        summary.metrics.layeredApplication.promptTokensWhenApplied
          ? asPercent(summary.metrics.layeredApplication.promptTokensWhenApplied.savingsRatio.mean)
          : 'n/a'
      }`
  )

  const allPass = savingsPass && evidencePass && infoLossPass && layerAdequacyPass
  if (!allPass) {
    console.error('[ContextEval:Gate] FAILED')
    process.exit(1)
  }

  console.log('[ContextEval:Gate] PASSED')
}

main().catch((error) => {
  console.error('[ContextEval:Gate] Error:', error instanceof Error ? error.message : String(error))
  process.exit(1)
})

