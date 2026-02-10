/**
 * Token estimation for LLM messages
 *
 * Provides language-aware token estimation that handles:
 * - English text (~4 chars/token, we use conservative 2.5)
 * - CJK text (Chinese/Japanese/Korean, ~1.3 tokens per character)
 * - Images (based on Claude's formula: pixels/750)
 * - Tool use/result blocks
 */

import Anthropic from '@anthropic-ai/sdk'

/**
 * Estimate token count for a text string.
 *
 * Token ratios vary by language and tokenizer:
 * - English: ~4 chars per token (GPT/Claude BPE)
 * - Chinese/Japanese/Korean (CJK): ~0.75 chars per token (1 CJK char ≈ 1.3 tokens)
 * - Mixed content: we detect CJK ratio and interpolate
 *
 * We use a conservative approach to avoid underestimation which causes
 * "prompt too long" errors that are harder to recover from.
 */
export function estimateTextTokens(text: string): number {
  if (!text) return 0

  // Count CJK characters (Chinese, Japanese Kanji, Korean)
  // CJK Unified Ideographs: U+4E00–U+9FFF
  // CJK Extension A: U+3400–U+4DBF
  // Hiragana: U+3040–U+309F, Katakana: U+30A0–U+30FF
  // Hangul: U+AC00–U+D7AF
  // Fullwidth punctuation: U+FF00–U+FFEF
  const cjkRegex =
    /[\u3000-\u303F\u3040-\u309F\u30A0-\u30FF\u3400-\u4DBF\u4E00-\u9FFF\uAC00-\uD7AF\uF900-\uFAFF\uFF00-\uFFEF]/g
  const cjkMatches = text.match(cjkRegex)
  const cjkCount = cjkMatches ? cjkMatches.length : 0
  const totalChars = text.length

  if (totalChars === 0) return 0

  // CJK characters: ~1.3 tokens per character (conservative)
  // Non-CJK characters: ~0.4 tokens per character (1 token per 2.5 chars, conservative)
  const nonCjkCount = totalChars - cjkCount
  const tokens = Math.ceil(cjkCount * 1.3) + Math.ceil(nonCjkCount / 2.5)

  // Add per-message overhead (role, formatting, separators)
  return tokens + 4
}

/**
 * Estimate image token cost.
 *
 * Claude: tokens = (width * height) / 750, max ~1600 after resize to 1568px
 *   - Typical image: 1092x1092 = ~1590 tokens
 *   - Images are resized down to max 1568px on long edge before tokenizing
 *
 * GLM/other providers: image tokens vary but typically 1000-2000 range
 *
 * We use 1600 as default which matches Claude's typical cost for standard images.
 */
const DEFAULT_IMAGE_TOKENS = 1600

/**
 * Estimate token count for a message.
 * Handles text, images, tool_use, and tool_result blocks with
 * language-aware text estimation and accurate image cost modeling.
 */
export function estimateTokens(message: Anthropic.MessageParam): number {
  if (typeof message.content === 'string') {
    return estimateTextTokens(message.content)
  }

  let tokens = 0
  for (const block of message.content) {
    if (block.type === 'text') {
      tokens += estimateTextTokens(block.text)
    } else if (block.type === 'image') {
      tokens += DEFAULT_IMAGE_TOKENS
    } else if (block.type === 'tool_use') {
      tokens += estimateTextTokens(JSON.stringify(block))
    } else if (block.type === 'tool_result') {
      if (typeof block.content === 'string') {
        tokens += estimateTextTokens(block.content)
      } else if (Array.isArray(block.content)) {
        for (const item of block.content) {
          if (item.type === 'text') {
            tokens += estimateTextTokens(item.text)
          } else if (item.type === 'image') {
            tokens += DEFAULT_IMAGE_TOKENS
          }
        }
      } else {
        tokens += estimateTextTokens(JSON.stringify(block.content))
      }
    }
  }
  return tokens
}
