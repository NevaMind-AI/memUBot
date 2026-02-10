/**
 * Context management module
 *
 * Handles all aspects of LLM conversation context:
 * - Token estimation (language-aware)
 * - Context compaction (offload large tool results to files)
 * - Constants and configuration
 */

export { MAX_CONTEXT_MESSAGES, MAX_CONTEXT_TOKENS } from './constants'
export { estimateTokens, estimateTextTokens } from './token-estimator'
export { compactToolResults, cleanupOffloadedFiles } from './compactor'
