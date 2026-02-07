/**
 * Agent Service Module
 * 
 * This module provides the AgentService class for handling conversations with Claude
 * and executing tools. It supports Computer Use for full computer control.
 * 
 * Module structure:
 * - types.ts: Type definitions
 * - prompts/: System prompts directory
 *   - index.ts: Entry point and prompt builders
 *   - types.ts: Prompt-related type definitions
 *   - shared.ts: Shared prompt components
 *   - memu.ts: memu-bot specific prompts
 *   - yumi.ts: Yumi specific prompts
 * - utils.ts: Utility functions (estimateTokens, createClient, etc.)
 * - tools.ts: Tool selection for platforms
 * - tool-executor.ts: Tool execution logic
 * - prompt-builder.ts: System prompt construction
 * - agent.service.ts: Main AgentService class
 */

// Re-export types
export type {
  MessagePlatform,
  UnmemorizedMessage,
  EvaluationDecision,
  EvaluationContext,
  EvaluationData,
  LLMStatus,
  LLMStatusInfo,
  ToolResult
} from './types'

// Re-export utils
export {
  MAX_CONTEXT_MESSAGES,
  MAX_CONTEXT_TOKENS,
  estimateTokens,
  getDefaultOutputDir,
  createClient
} from './utils'

// Re-export tools
export { getToolsForPlatform } from './tools'
export type { ExperimentalToolOptions } from './tools'

// Re-export tool executor
export { executeTool } from './tool-executor'

// Re-export prompt builder
export { getSystemPromptForPlatform } from './prompt-builder'

// Re-export prompts (in case needed externally)
export {
  TELEGRAM_SYSTEM_PROMPT,
  DISCORD_SYSTEM_PROMPT,
  WHATSAPP_SYSTEM_PROMPT,
  SLACK_SYSTEM_PROMPT,
  LINE_SYSTEM_PROMPT,
  FEISHU_SYSTEM_PROMPT,
  DEFAULT_SYSTEM_PROMPT,
  VISUAL_DEMO_PROMPT
} from './prompts'

// Main service - import from original file for now
// This allows gradual migration without breaking existing code
import { AgentService, agentService } from '../agent.service'
export { AgentService, agentService }
