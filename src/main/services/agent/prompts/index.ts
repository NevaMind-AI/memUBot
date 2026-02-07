/**
 * Prompts module - Entry point
 * 
 * This module provides system prompts for the AI agent.
 * Prompts are split by app mode (memu-bot vs yumi) for customization.
 */

import { MEMU_BOT_INTRO } from './memu'
import {
  BASE_GUIDELINES,
  BASE_TOOLS,
  COMMUNICATION_GUIDELINES,
  EXPERTISE_BASE,
  PLATFORM_CONFIGS
} from './shared'
import { YUMI_INTRO } from './yumi'

// Re-export types
export type { PlatformConfig } from './types'

// Re-export shared components
export { VISUAL_DEMO_PROMPT } from './shared'

// ============================================
// Intro getter
// ============================================

const getIntro = (appMode: 'memu' | 'yumi' = 'memu'): string => {
  console.log(`[Agent] Getting intro for app mode: ${appMode}`)
  return appMode === 'yumi' ? YUMI_INTRO : MEMU_BOT_INTRO
}

// ============================================
// Prompt builder function
// ============================================

function buildPlatformPrompt(platform: keyof typeof PLATFORM_CONFIGS, appMode: 'memu' | 'yumi' = 'memu'): string {
  const config = PLATFORM_CONFIGS[platform]
  
  return `${getIntro(appMode)}

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
 * Get system prompt for a specific platform and app mode
 */
export const getSystemPrompt = (platform: string, appMode: 'memu' | 'yumi' = 'memu'): string => {
  if (platform in PLATFORM_CONFIGS) {
    return buildPlatformPrompt(platform as keyof typeof PLATFORM_CONFIGS, appMode)
  }
  return getDefaultSystemPrompt(appMode)
}

/**
 * Get default system prompt for a specific app mode
 */
export const getDefaultSystemPrompt = (appMode: 'memu' | 'yumi' = 'memu'): string => `${getIntro(appMode)}

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
export const DEFAULT_SYSTEM_PROMPT = getDefaultSystemPrompt('memu')
