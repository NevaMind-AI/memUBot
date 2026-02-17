import { trimToTokenTarget, normalizeWhitespace } from './text-utils'

export interface LlmSummaryProvider {
  summarize(input: string, targetTokens: number, level: 'overview' | 'abstract'): Promise<string>
}

export interface SummaryResult {
  text: string
  fallbackUsed: boolean
  fallbackReason?: string
}

function sentenceSplit(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/g)
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
}

function fallbackOverview(input: string, targetTokens: number): string {
  const normalized = normalizeWhitespace(input)
  if (!normalized) return 'No historical content was available.'

  const lines = normalized
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  const selected = lines.slice(0, 18)
  const summary = [
    'Archive overview:',
    ...selected.map((line) => `- ${line}`)
  ].join('\n')
  return trimToTokenTarget(summary, targetTokens)
}

function fallbackAbstract(overview: string, targetTokens: number): string {
  const sentences = sentenceSplit(normalizeWhitespace(overview))
  const first = sentences.slice(0, 2).join(' ')
  const base = first || overview
  return trimToTokenTarget(base, targetTokens)
}

export class LayeredSummaryGenerator {
  constructor(private readonly llmProvider?: LlmSummaryProvider) {}

  async generateOverview(input: string, targetTokens: number): Promise<SummaryResult> {
    if (this.llmProvider) {
      try {
        const generated = await this.llmProvider.summarize(input, targetTokens, 'overview')
        const normalized = trimToTokenTarget(generated, targetTokens)
        if (normalized) {
          return { text: normalized, fallbackUsed: false }
        }
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error)
        return {
          text: fallbackOverview(input, targetTokens),
          fallbackUsed: true,
          fallbackReason: `overview_llm_failed:${reason}`
        }
      }

      return {
        text: fallbackOverview(input, targetTokens),
        fallbackUsed: true,
        fallbackReason: 'overview_llm_empty'
      }
    }

    return {
      text: fallbackOverview(input, targetTokens),
      fallbackUsed: false
    }
  }

  async generateAbstract(overview: string, targetTokens: number): Promise<SummaryResult> {
    if (this.llmProvider) {
      try {
        const generated = await this.llmProvider.summarize(overview, targetTokens, 'abstract')
        const normalized = trimToTokenTarget(generated, targetTokens)
        if (normalized) {
          return { text: normalized, fallbackUsed: false }
        }
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error)
        return {
          text: fallbackAbstract(overview, targetTokens),
          fallbackUsed: true,
          fallbackReason: `abstract_llm_failed:${reason}`
        }
      }

      return {
        text: fallbackAbstract(overview, targetTokens),
        fallbackUsed: true,
        fallbackReason: 'abstract_llm_empty'
      }
    }

    return {
      text: fallbackAbstract(overview, targetTokens),
      fallbackUsed: false
    }
  }
}
