import type Anthropic from '@anthropic-ai/sdk'

/**
 * Supported platforms for messaging tools
 */
export type MessagePlatform = 'telegram' | 'discord' | 'whatsapp' | 'slack' | 'line' | 'feishu' | 'yumi' | 'none'

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
 * - idle: App started but never processed any message
 * - thinking: Currently processing, waiting for LLM response
 * - tool_executing: Currently executing a tool
 * - complete: Last request completed successfully
 * - aborted: Last request was aborted/interrupted
 */
export type LLMStatus = 'idle' | 'thinking' | 'tool_executing' | 'complete' | 'aborted'

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

/**
 * Token usage information for an activity
 */
export interface TokenUsage {
  // Estimated tokens (before API call)
  estimated?: {
    messages: number
    system: number
    tools: number
    total: number
  }
  // Actual tokens (from API response)
  actual?: {
    input: number
    output: number
    total: number
  }
}

/**
 * Agent activity item - represents a single step in the agent's processing
 */
export type AgentActivityType = 'thinking' | 'tool_call' | 'tool_result' | 'response'

export interface AgentActivityItem {
  id: string
  type: AgentActivityType
  timestamp: number
  iteration?: number
  // Token usage for this step
  tokenUsage?: TokenUsage
  // For thinking
  content?: string
  // For tool_call
  toolName?: string
  toolInput?: Record<string, unknown>
  // For tool_result
  toolUseId?: string
  success?: boolean
  result?: string
  error?: string
  // For response
  message?: string
}
