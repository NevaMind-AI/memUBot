import type { LayeredRetrievalResult } from './types'

export interface LayeredContextMetricsSnapshot {
  totalRuns: number
  totalSavingsTokens: number
  avgSavingsTokens: number
  avgSavingsRatio: number
  fallbackEvents: number
}

export class LayeredContextMetrics {
  private totalRuns = 0
  private totalSavingsTokens = 0
  private totalSavingsRatio = 0
  private fallbackEvents = 0

  recordRetrieval(result: LayeredRetrievalResult): void {
    this.totalRuns += 1
    this.totalSavingsTokens += result.tokenUsage.savings
    this.totalSavingsRatio += result.tokenUsage.savingsRatio
  }

  recordFallback(count: number): void {
    this.fallbackEvents += count
  }

  snapshot(): LayeredContextMetricsSnapshot {
    return {
      totalRuns: this.totalRuns,
      totalSavingsTokens: this.totalSavingsTokens,
      avgSavingsTokens: this.totalRuns > 0 ? this.totalSavingsTokens / this.totalRuns : 0,
      avgSavingsRatio: this.totalRuns > 0 ? this.totalSavingsRatio / this.totalRuns : 0,
      fallbackEvents: this.fallbackEvents
    }
  }
}
