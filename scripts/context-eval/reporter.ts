import fs from 'node:fs/promises'
import path from 'node:path'
import type { CaseEvaluationResult, ContextEvalSummary, WriteArtifactsResult } from './types'

function asPercent(value: number, fractionDigits: number = 2): string {
  return `${(value * 100).toFixed(fractionDigits)}%`
}

function asNumber(value: number, fractionDigits: number = 2): string {
  return value.toFixed(fractionDigits)
}

function escapeCsv(input: string): string {
  if (input.includes('"') || input.includes(',') || input.includes('\n')) {
    return `"${input.replace(/"/g, '""')}"`
  }
  return input
}

function rankRegression(caseResult: CaseEvaluationResult): number {
  let score = 0
  if (caseResult.informationLossIncident) score += 500
  if (caseResult.layerAdequacyPass === false) score += 200
  if (caseResult.evidenceRecallDelta !== null && caseResult.evidenceRecallDelta < 0) {
    score += Math.abs(caseResult.evidenceRecallDelta) * 100
  }
  if (caseResult.promptTokenSavingsRatio < 0) {
    score += Math.abs(caseResult.promptTokenSavingsRatio) * 100
  }
  return score
}

function buildSummaryMarkdown(summary: ContextEvalSummary, results: CaseEvaluationResult[]): string {
  const token = summary.metrics.promptTokens
  const evidence = summary.metrics.evidenceRecall
  const layeredApplication = summary.metrics.layeredApplication
  const topRegressions = [...results]
    .filter((item) => rankRegression(item) > 0)
    .sort((a, b) => rankRegression(b) - rankRegression(a))
    .slice(0, 8)

  const lines: string[] = []
  lines.push('# Context Evaluation Report')
  lines.push('')
  lines.push(`- Run ID: \`${summary.runId}\``)
  lines.push(`- Generated At: \`${summary.generatedAt}\``)
  lines.push(`- Dataset: \`${summary.datasetPath}\``)
  lines.push(`- Cases: \`${summary.caseCount}\``)
  lines.push('')
  lines.push('## Gate Metrics')
  lines.push('')
  lines.push(`- Mean prompt token savings: \`${asPercent(token.savingsRatio.mean)}\``)
  lines.push(
    `- Evidence recall delta (candidate - baseline): \`${evidence.delta ? asPercent(evidence.delta.mean) : 'n/a'}\``
  )
  lines.push(`- Layer adequacy rate: \`${summary.metrics.layerAdequacyRate !== null ? asPercent(summary.metrics.layerAdequacyRate) : 'n/a'}\``)
  lines.push(`- Information loss rate: \`${summary.metrics.informationLossRate !== null ? asPercent(summary.metrics.informationLossRate) : 'n/a'}\``)
  lines.push('')
  lines.push('## Layered Application')
  lines.push('')
  lines.push(
    `- Applied cases: \`${layeredApplication.appliedCaseCount}/${summary.caseCount}\` (${asPercent(layeredApplication.applyRate)})`
  )
  if (layeredApplication.promptTokensWhenApplied) {
    lines.push(
      `- Applied-only baseline mean / p50 / p95: \`${asNumber(layeredApplication.promptTokensWhenApplied.baseline.mean)} / ${asNumber(layeredApplication.promptTokensWhenApplied.baseline.p50)} / ${asNumber(layeredApplication.promptTokensWhenApplied.baseline.p95)}\``
    )
    lines.push(
      `- Applied-only candidate mean / p50 / p95: \`${asNumber(layeredApplication.promptTokensWhenApplied.candidate.mean)} / ${asNumber(layeredApplication.promptTokensWhenApplied.candidate.p50)} / ${asNumber(layeredApplication.promptTokensWhenApplied.candidate.p95)}\``
    )
    lines.push(
      `- Applied-only savings mean / p50 / p95: \`${asPercent(layeredApplication.promptTokensWhenApplied.savingsRatio.mean)} / ${asPercent(layeredApplication.promptTokensWhenApplied.savingsRatio.p50)} / ${asPercent(layeredApplication.promptTokensWhenApplied.savingsRatio.p95)}\``
    )
  } else {
    lines.push('- No applied layered cases in this run.')
  }
  lines.push('')
  lines.push('## Token Distribution')
  lines.push('')
  lines.push(`- Baseline mean / p50 / p95: \`${asNumber(token.baseline.mean)} / ${asNumber(token.baseline.p50)} / ${asNumber(token.baseline.p95)}\``)
  lines.push(`- Candidate mean / p50 / p95: \`${asNumber(token.candidate.mean)} / ${asNumber(token.candidate.p50)} / ${asNumber(token.candidate.p95)}\``)
  lines.push(`- Savings ratio mean / p50 / p95: \`${asPercent(token.savingsRatio.mean)} / ${asPercent(token.savingsRatio.p50)} / ${asPercent(token.savingsRatio.p95)}\``)
  lines.push('')
  lines.push('## Quality Metrics')
  lines.push('')
  lines.push(`- Regression cases: \`${summary.metrics.regressionCases}\``)
  lines.push(`- Stable or improved cases: \`${summary.metrics.stableOrImprovedCases}\``)
  if (evidence.delta) {
    lines.push(
      `- Evidence delta 95% CI: \`[${asPercent(evidence.delta.lower95)}, ${asPercent(evidence.delta.upper95)}]\` (${evidence.delta.sampleCount} samples)`
    )
  }
  lines.push('')
  lines.push('## Top Regressions')
  lines.push('')

  if (topRegressions.length === 0) {
    lines.push('- No regression case was detected in this run.')
  } else {
    for (const item of topRegressions) {
      lines.push(
        `- \`${item.caseId}\`: token=${asPercent(item.promptTokenSavingsRatio)}, evidenceDelta=${
          item.evidenceRecallDelta !== null ? asPercent(item.evidenceRecallDelta) : 'n/a'
        }, layer=${item.candidate.reachedLayer ?? 'none'}`
      )
    }
  }

  return lines.join('\n')
}

function buildRegressionsMarkdown(results: CaseEvaluationResult[]): string {
  const regressions = [...results]
    .filter((item) => rankRegression(item) > 0)
    .sort((a, b) => rankRegression(b) - rankRegression(a))

  const lines: string[] = []
  lines.push('# Context Evaluation Regressions')
  lines.push('')

  if (regressions.length === 0) {
    lines.push('No regressions detected.')
    return lines.join('\n')
  }

  for (const item of regressions) {
    lines.push(`## ${item.caseId}`)
    lines.push('')
    lines.push(`- Query: ${item.query}`)
    lines.push(`- Prompt token savings: ${asPercent(item.promptTokenSavingsRatio)}`)
    lines.push(
      `- Evidence recall (baseline -> candidate): ${
        item.baseline.evidenceScore ? asPercent(item.baseline.evidenceScore.recall) : 'n/a'
      } -> ${item.candidate.evidenceScore ? asPercent(item.candidate.evidenceScore.recall) : 'n/a'}`
    )
    lines.push(`- Layer reached: ${item.candidate.reachedLayer ?? 'none'}`)
    lines.push(`- Layer adequacy pass: ${item.layerAdequacyPass === null ? 'n/a' : String(item.layerAdequacyPass)}`)
    lines.push(`- Information loss incident: ${item.informationLossIncident === null ? 'n/a' : String(item.informationLossIncident)}`)
    lines.push('- Explanation:')
    if (item.explanation.length === 0) {
      lines.push('  - No additional explanation generated.')
    } else {
      for (const explanation of item.explanation) {
        lines.push(`  - ${explanation}`)
      }
    }
    lines.push('')
  }

  return lines.join('\n')
}

function buildCasesCsv(results: CaseEvaluationResult[]): string {
  const headers = [
    'caseId',
    'promptTokensBaseline',
    'promptTokensCandidate',
    'promptTokenSavingsRatio',
    'evidenceRecallBaseline',
    'evidenceRecallCandidate',
    'evidenceRecallDelta',
    'layeredApplied',
    'reachedLayer',
    'layerAdequacyPass',
    'informationLossIncident',
    'decisionReason',
    'explanation'
  ]

  const rows = [headers.join(',')]
  for (const item of results) {
    rows.push(
      [
        item.caseId,
        String(item.baseline.promptTokens),
        String(item.candidate.promptTokens),
        String(item.promptTokenSavingsRatio),
        item.baseline.evidenceScore ? String(item.baseline.evidenceScore.recall) : '',
        item.candidate.evidenceScore ? String(item.candidate.evidenceScore.recall) : '',
        item.evidenceRecallDelta !== null ? String(item.evidenceRecallDelta) : '',
        String(item.candidate.layeredApplied),
        item.candidate.reachedLayer ?? '',
        item.layerAdequacyPass === null ? '' : String(item.layerAdequacyPass),
        item.informationLossIncident === null ? '' : String(item.informationLossIncident),
        item.candidate.decisionReason ?? '',
        item.explanation.join(' | ')
      ]
        .map((value) => escapeCsv(value))
        .join(',')
    )
  }

  return rows.join('\n')
}

export async function writeRunArtifacts(
  summary: ContextEvalSummary,
  results: CaseEvaluationResult[]
): Promise<WriteArtifactsResult> {
  const runDirectory = path.join(summary.outputDir, summary.runId)
  await fs.mkdir(runDirectory, { recursive: true })

  const summaryJsonPath = path.join(runDirectory, 'summary.json')
  const summaryMarkdownPath = path.join(runDirectory, 'summary.md')
  const casesCsvPath = path.join(runDirectory, 'cases.csv')
  const regressionsPath = path.join(runDirectory, 'regressions.md')
  const latestPointerPath = path.join(summary.outputDir, 'latest.json')

  await fs.writeFile(summaryJsonPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf-8')
  await fs.writeFile(summaryMarkdownPath, `${buildSummaryMarkdown(summary, results)}\n`, 'utf-8')
  await fs.writeFile(casesCsvPath, `${buildCasesCsv(results)}\n`, 'utf-8')
  await fs.writeFile(regressionsPath, `${buildRegressionsMarkdown(results)}\n`, 'utf-8')
  await fs.writeFile(
    latestPointerPath,
    `${JSON.stringify({ runId: summary.runId, runDirectory, summaryJsonPath }, null, 2)}\n`,
    'utf-8'
  )

  return {
    runDirectory,
    summaryJsonPath,
    summaryMarkdownPath,
    casesCsvPath,
    regressionsPath,
    latestPointerPath
  }
}

