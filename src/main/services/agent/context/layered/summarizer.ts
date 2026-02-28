import { trimToTokenTarget, normalizeWhitespace } from './text-utils'

export interface LlmSummaryProvider {
  summarize(input: string, targetTokens: number, level: 'summary' | 'abstract'): Promise<string>
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

function fallbackSummary(input: string, targetTokens: number): string {
  const normalized = normalizeWhitespace(input)
  if (!normalized) return 'No historical content was available.'

  const lines = normalized
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  const selected = lines.slice(0, 18)
  const result = [
    'Archive summary:',
    ...selected.map((line) => `- ${line}`)
  ].join('\n')
  return trimToTokenTarget(result, targetTokens)
}

function fallbackAbstract(summary: string, targetTokens: number): string {
  const sentences = sentenceSplit(normalizeWhitespace(summary))
  const first = sentences.slice(0, 2).join(' ')
  const base = first || summary
  return trimToTokenTarget(base, targetTokens)
}

export class LayeredSummaryGenerator {
  constructor(private readonly llmProvider?: LlmSummaryProvider) {}

  async generateSummary(input: string, targetTokens: number): Promise<SummaryResult> {
    if (this.llmProvider) {
      try {
        const generated = await this.llmProvider.summarize(input, targetTokens, 'summary')
        const normalized = trimToTokenTarget(generated, targetTokens)
        if (normalized) {
          return { text: normalized, fallbackUsed: false }
        }
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error)
        return {
          text: fallbackSummary(input, targetTokens),
          fallbackUsed: true,
          fallbackReason: `summary_llm_failed:${reason}`
        }
      }

      return {
        text: fallbackSummary(input, targetTokens),
        fallbackUsed: true,
        fallbackReason: 'summary_llm_empty'
      }
    }

    return {
      text: fallbackSummary(input, targetTokens),
      fallbackUsed: false
    }
  }

  async generateAbstract(summary: string, targetTokens: number): Promise<SummaryResult> {
    if (this.llmProvider) {
      try {
        const generated = await this.llmProvider.summarize(summary, targetTokens, 'abstract')
        const normalized = trimToTokenTarget(generated, targetTokens)
        if (normalized) {
          return { text: normalized, fallbackUsed: false }
        }
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error)
        return {
          text: fallbackAbstract(summary, targetTokens),
          fallbackUsed: true,
          fallbackReason: `abstract_llm_failed:${reason}`
        }
      }

      return {
        text: fallbackAbstract(summary, targetTokens),
        fallbackUsed: true,
        fallbackReason: 'abstract_llm_empty'
      }
    }

    return {
      text: fallbackAbstract(summary, targetTokens),
      fallbackUsed: false
    }
  }
}
