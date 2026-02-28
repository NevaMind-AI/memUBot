/**
 * Prompts module - Entry point
 * 
 * This module provides system prompts for the AI agent.
 */

import { MEMU_BOT_INTRO } from './memu'
import {
  BASE_GUIDELINES,
  BASE_TOOLS,
  COMMUNICATION_GUIDELINES,
  EXPERTISE_BASE,
  PLATFORM_CONFIGS
} from './shared'

// Re-export types
export type { PlatformConfig } from './types'

// Re-export shared components
export { VISUAL_DEMO_PROMPT } from './shared'

// ============================================
// Prompt builder function
// ============================================

function buildPlatformPrompt(platform: keyof typeof PLATFORM_CONFIGS): string {
  const config = PLATFORM_CONFIGS[platform]
  
  return `${MEMU_BOT_INTRO}

You have access to:
${BASE_TOOLS}
${config.messagingCapabilities}

Guidelines:
${BASE_GUIDELINES}
${config.toolGuideline}

${COMMUNICATION_GUIDELINES}

${EXPERTISE_BASE}
- Sharing files and media via ${config.name}
- Any command-line task the user needs help with`
}

// ============================================
// Exported functions
// ============================================

/**
 * Get system prompt for a specific platform
 */
export const getSystemPrompt = (platform: string): string => {
  if (platform in PLATFORM_CONFIGS) {
    return buildPlatformPrompt(platform as keyof typeof PLATFORM_CONFIGS)
  }
  return getDefaultSystemPrompt()
}

/**
 * Get default system prompt
 */
export const getDefaultSystemPrompt = (): string => `${MEMU_BOT_INTRO}

You have access to:
${BASE_TOOLS}

Guidelines:
${BASE_GUIDELINES}
- **AVOID** repeating yourself - keep responses concise
- **NEVER** send "backup", "emergency backup", or "context summary" messages - do NOT claim context is being cleared or try to preserve information across sessions

${EXPERTISE_BASE}
- Any command-line task the user needs help with`

// ============================================
// Legacy exports for backward compatibility
// ============================================

export const TELEGRAM_SYSTEM_PROMPT = buildPlatformPrompt('telegram')
export const DISCORD_SYSTEM_PROMPT = buildPlatformPrompt('discord')
export const WHATSAPP_SYSTEM_PROMPT = buildPlatformPrompt('whatsapp')
export const SLACK_SYSTEM_PROMPT = buildPlatformPrompt('slack')
export const LINE_SYSTEM_PROMPT = buildPlatformPrompt('line')
export const FEISHU_SYSTEM_PROMPT = buildPlatformPrompt('feishu')
export const DEFAULT_SYSTEM_PROMPT = getDefaultSystemPrompt()
