/**
 * Context management constants
 *
 * Centralized configuration for all context window management:
 * message limits, token budgets, and compaction thresholds.
 */

/**
 * Maximum number of historical messages to load as context.
 * Each "round" of conversation has ~3 entries (user + assistant + tool),
 * so 20 rounds ≈ 60 entries.
 */
export const MAX_CONTEXT_MESSAGES = 20

/**
 * Maximum tokens for context (client-side fallback)
 *
 * For Claude API: Server-side context editing triggers at 100k tokens.
 * This client-side limit (150k) serves as a fallback for:
 * - Non-Claude providers (MiniMax, Custom) that don't support context editing
 * - Edge cases where server-side editing doesn't trigger
 *
 * Claude's limit is 200k, we leave room for system prompt (~5k), tools (~10k), and response (~20k)
 */
export const MAX_CONTEXT_TOKENS = 150000

/**
 * Character threshold for offloading tool_result content to a file.
 * Content exceeding this is written to a temp file and replaced with a path reference.
 * The LLM can use file_read to access the full content on demand.
 */
export const TOOL_RESULT_FILE_THRESHOLD = 2000

/**
 * Number of recent tool_use/tool_result pairs to keep in-context (not offloaded).
 * Only older tool results beyond this count are candidates for file offloading.
 */
export const KEEP_RECENT_TOOL_PAIRS = 3

/**
 * Directory name for storing offloaded tool result files.
 * Files are placed under the app's userData directory.
 */
export const CONTEXT_OFFLOAD_DIR = 'context-offload'
