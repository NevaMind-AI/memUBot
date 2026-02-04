import path from 'path'
import * as fs from 'fs/promises'
import { loadSettings } from '../../config/settings.config'
import { isMacOS } from '../../tools/macos/definitions'
import { skillsService } from '../skills.service'
import { serviceManagerService } from '../service-manager.service'
import { getDefaultOutputDir } from './utils'
import {
  TELEGRAM_SYSTEM_PROMPT,
  DISCORD_SYSTEM_PROMPT,
  WHATSAPP_SYSTEM_PROMPT,
  SLACK_SYSTEM_PROMPT,
  LINE_SYSTEM_PROMPT,
  FEISHU_SYSTEM_PROMPT,
  DEFAULT_SYSTEM_PROMPT,
  VISUAL_DEMO_PROMPT
} from './prompts'
import type { MessagePlatform } from './types'

/**
 * Format current date and time for system prompt
 */
function getCurrentTimeInfo(): string {
  const now = new Date()
  
  // Format date: YYYY-MM-DD (Weekday)
  const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const weekday = weekdays[now.getDay()]
  const dateStr = now.toLocaleDateString('en-CA') // YYYY-MM-DD format
  
  // Format time: HH:MM:SS
  const timeStr = now.toLocaleTimeString('en-US', { hour12: false })
  
  // Get timezone
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const tzOffset = now.getTimezoneOffset()
  const tzSign = tzOffset <= 0 ? '+' : '-'
  const tzHours = Math.floor(Math.abs(tzOffset) / 60).toString().padStart(2, '0')
  const tzMinutes = (Math.abs(tzOffset) % 60).toString().padStart(2, '0')
  const tzString = `UTC${tzSign}${tzHours}:${tzMinutes}`
  
  return `## Current Time

Current date and time: ${dateStr} (${weekday}) ${timeStr}
Timezone: ${timezone} (${tzString})`
}

/**
 * Get system prompt for a specific platform
 */
export async function getSystemPromptForPlatform(platform: MessagePlatform): Promise<string> {
  const settings = await loadSettings()
  const defaultOutputDir = getDefaultOutputDir()
  
  // Get base system prompt
  let basePrompt: string
  if (settings.systemPrompt) {
    basePrompt = settings.systemPrompt
  } else {
    switch (platform) {
      case 'telegram':
        basePrompt = TELEGRAM_SYSTEM_PROMPT
        break
      case 'discord':
        basePrompt = DISCORD_SYSTEM_PROMPT
        break
      case 'whatsapp':
        basePrompt = WHATSAPP_SYSTEM_PROMPT
        break
      case 'slack':
        basePrompt = SLACK_SYSTEM_PROMPT
        break
      case 'line':
        basePrompt = LINE_SYSTEM_PROMPT
        break
      case 'feishu':
        basePrompt = FEISHU_SYSTEM_PROMPT
        break
      case 'none':
      default:
        basePrompt = DEFAULT_SYSTEM_PROMPT
    }
  }
  
  // Add current time information at the beginning
  const timeInfo = getCurrentTimeInfo()
  basePrompt = timeInfo + '\n\n' + basePrompt
  
  // Add default output directory instruction
  const outputDirInstruction = `

## Default Output Directory

When creating or saving files (images, documents, code, etc.), use the following directory as the default location:
\`${defaultOutputDir}\`

**CRITICAL FILE HANDLING RULES:**

1. **All generated/downloaded/new files MUST be saved to the private directory first**
   - Generated files (images from MCP, created documents, etc.)
   - Downloaded files (from URLs, APIs, etc.)
   - Any new file that will be shared with the user
   
2. **Always use private directory paths in conversation history**
   - Store and reference files using their path in \`${defaultOutputDir}\`
   - This ensures files persist and are accessible later
   
3. **For user-specified destinations (Desktop, Downloads, etc.):**
   - First save to private directory
   - Then COPY (not move) to the user-requested location
   - Report both paths to user if relevant
   
4. **Exception: Existing local files**
   - If referencing a file that already exists on user's system, use its original path
   - Only apply the above rules to NEW files

5. **Subdirectory organization:**
   - images/ - for generated/downloaded images
   - downloads/ - for downloaded files
   - documents/ - for created documents
   - code/ - for generated code files`

  basePrompt += outputDirInstruction

  // Append service workspace info
  const servicesDir = serviceManagerService.getServicesDir()
  basePrompt += `

## Service Workspace

When creating background services, use this directory:
\`${servicesDir}\`

Services should call the local API at http://127.0.0.1:31415/api/v1/invoke to report events.`

  // Load builtin skills (bundled with app)
  const builtinSkillNames = ['service-creator', 'keynote-creator']
  for (const skillName of builtinSkillNames) {
    try {
      const builtinSkillsDir = path.join(__dirname, '../../builtin-skills')
      const builtinSkillPath = path.join(builtinSkillsDir, skillName, 'SKILL.md')
      const builtinContent = await fs.readFile(builtinSkillPath, 'utf-8')
      basePrompt += '\n\n' + builtinContent
      console.log(`[Agent] Loaded builtin skill: ${skillName}`)
    } catch {
      // Builtin skills may not exist in dev mode, try src path
      try {
        const devSkillPath = path.join(process.cwd(), 'src/main/builtin-skills', skillName, 'SKILL.md')
        const devContent = await fs.readFile(devSkillPath, 'utf-8')
        basePrompt += '\n\n' + devContent
        console.log(`[Agent] Loaded builtin skill from dev path: ${skillName}`)
      } catch {
        console.log(`[Agent] Builtin skill not found: ${skillName} (this is ok in some environments)`)
      }
    }
  }
  
  // Append user-enabled skills content
  try {
    const skillsContent = await skillsService.getEnabledSkillsContent()
    if (skillsContent) {
      console.log('[Agent] Loaded user skills content, length:', skillsContent.length)
      basePrompt += skillsContent
    } else {
      console.log('[Agent] No user skills to load')
    }
  } catch (error) {
    console.error('[Agent] Failed to load user skills:', error)
  }
  
  // Conditional injection: Visual demo prompt (only when experimentalVisualMode is enabled)
  // This keeps the code clean: when disabled, Agent doesn't know about visual operations
  if (settings.experimentalVisualMode && isMacOS()) {
    basePrompt += VISUAL_DEMO_PROMPT
    console.log('[Agent] Visual demo mode enabled - added visual prompt')
  }
  
  return basePrompt
}
