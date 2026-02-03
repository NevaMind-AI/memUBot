import type Anthropic from '@anthropic-ai/sdk'

/**
 * Supported platforms for messaging tools
 */
export type MessagePlatform = 'telegram' | 'discord' | 'whatsapp' | 'slack' | 'line' | 'feishu' | 'none'

/**
 * Unmemorized message with metadata
 */
export interface UnmemorizedMessage {
  platform: MessagePlatform
  timestamp: number // Unix timestamp in seconds
  message: Anthropic.MessageParam
}

/**
 * Evaluation decision from LLM
 */
export interface EvaluationDecision {
  shouldNotify: boolean
  message?: string  // Message to send if shouldNotify is true
  reason: string    // Explanation of the decision
}

/**
 * Evaluation request context
 */
export interface EvaluationContext {
  userRequest: string
  expectation: string
}

/**
 * Evaluation request data
 */
export interface EvaluationData {
  summary: string
  details?: string
  timestamp: string
  metadata?: Record<string, unknown>
}

/**
 * LLM processing status
 */
export type LLMStatus = 'idle' | 'thinking' | 'tool_executing'

export interface LLMStatusInfo {
  status: LLMStatus
  currentTool?: string
  iteration?: number
}

/**
 * Tool execution result
 */
export interface ToolResult {
  success: boolean
  data?: unknown
  error?: string
}
