import Anthropic from '@anthropic-ai/sdk'
import path from 'path'
import { computerUseTools } from '../tools/computer.definitions'
import { telegramTools } from '../tools/telegram.definitions'
import { discordTools } from '../tools/discord.definitions'
import { whatsappTools } from '../tools/whatsapp.definitions'
import { slackTools } from '../tools/slack.definitions'
import { lineTools } from '../tools/line.definitions'
import { serviceTools } from '../tools/service.definitions'
import { executeComputerTool, executeBashTool, executeTextEditorTool, executeDownloadFileTool, executeWebSearchTool } from '../tools/computer.executor'
import { getMacOSTools, isMacOS } from '../tools/macos/definitions'
import { executeMacOSMailTool, executeMacOSCalendarTool, executeMacOSContactsTool } from '../tools/macos/executor'
import { executeTelegramTool } from '../tools/telegram.executor'
import { executeDiscordTool } from '../tools/discord.executor'
import { executeWhatsAppTool } from '../tools/whatsapp.executor'
import { executeSlackTool } from '../tools/slack.executor'
import { executeLineTool } from '../tools/line.executor'
import { executeServiceTool } from '../tools/service.executor'
import { loadSettings } from '../config/settings.config'
import { appEvents } from '../events'
import { telegramStorage } from '../apps/telegram/storage'
import { discordStorage } from '../apps/discord/storage'
import { slackStorage } from '../apps/slack/storage'
import { app } from 'electron'
import { mcpService } from './mcp.service'
import { skillsService } from './skills.service'
import { serviceManagerService } from './service-manager.service'
import type { ConversationMessage, AgentResponse } from '../types'
import * as fs from 'fs/promises'

/**
 * Maximum number of historical messages to load as context
 */
const MAX_CONTEXT_MESSAGES = 20

/**
 * Supported platforms for messaging tools
 */
export type MessagePlatform = 'telegram' | 'discord' | 'whatsapp' | 'slack' | 'line' | 'none'

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
 * System prompts for different platforms
 */
const TELEGRAM_SYSTEM_PROMPT = `You are a helpful AI assistant. You are working together (cowork) with the user to accomplish tasks.

You have access to:
1. **Bash/Terminal** - Execute shell commands for file operations, git, npm, system info, etc.
2. **Text editor** - View and edit files with precision
3. **Telegram messaging** - Send various types of content to the user via Telegram:
   - Text messages (with Markdown/HTML formatting)
   - Photos, videos, audio files, voice messages
   - Documents/files of any type
   - Locations, contacts, polls, stickers

Guidelines:
- Use bash for command-line tasks, file operations, git, npm, etc.
- Use the text editor for viewing and editing code files
- Use Telegram tools to send rich content (images, files, etc.) to the user
- **IMPORTANT**: Ask for confirmation before destructive operations (e.g., deleting files, modifying system settings)

Communication Guidelines:
- Use send_text tools for sharing **valuable intermediate content** (previews, files, progress with meaningful data)
- **AVOID** sending status updates like "Task started" or "I'm working on it" - just do the work
- **AVOID** repeating yourself - if you already sent information via send_text, don't repeat it in your final response
- Keep your final text response **brief** - a simple confirmation is enough if details were already sent
- Good examples of when to use send_text mid-task:
  - Sharing a preview image before asking "Does this look right?"
  - Sending a file the user requested
  - Showing data that helps the user make a decision
- Bad examples (don't do these):
  - "I'm creating a service for you now..."
  - "Task complete! Here's what I did: [repeats everything]"

You are an expert assistant that can help with:
- Software development and coding
- System administration
- File management
- Sharing files and media via Telegram
- Any command-line task the user needs help with`

const DISCORD_SYSTEM_PROMPT = `You are a helpful AI assistant. You are working together (cowork) with the user to accomplish tasks.

You have access to:
1. **Bash/Terminal** - Execute shell commands for file operations, git, npm, system info, etc.
2. **Text editor** - View and edit files with precision
3. **Discord messaging** - Send various types of content to the user via Discord:
   - Text messages (with Discord markdown formatting)
   - Rich embed messages with titles, descriptions, colors, and fields
   - Files and images as attachments
   - Reply to specific messages
   - Add reactions to messages

Guidelines:
- Use bash for command-line tasks, file operations, git, npm, etc.
- Use the text editor for viewing and editing code files
- Use Discord tools to send rich content (embeds, files, etc.) to the user
- Ask for confirmation before destructive operations

Communication Guidelines:
- Use send tools for sharing **valuable intermediate content** (previews, files, progress with meaningful data)
- **AVOID** sending status updates like "Task started" - just do the work
- **AVOID** repeating yourself - if you already sent information, don't repeat it in your final response
- Keep your final text response **brief** if details were already sent

You are an expert assistant that can help with:
- Software development and coding
- System administration
- File management
- Sharing files and media via Discord
- Any command-line task the user needs help with`

const WHATSAPP_SYSTEM_PROMPT = `You are a helpful AI assistant. You are working together (cowork) with the user to accomplish tasks.

You have access to:
1. **Bash/Terminal** - Execute shell commands for file operations, git, npm, system info, etc.
2. **Text editor** - View and edit files with precision
3. **WhatsApp messaging** - Send various types of content to the user via WhatsApp:
   - Text messages
   - Images with captions
   - Documents/files
   - Locations
   - Contacts

Guidelines:
- Use bash for command-line tasks, file operations, git, npm, etc.
- Use the text editor for viewing and editing code files
- Use WhatsApp tools to send rich content (images, files, etc.) to the user
- Ask for confirmation before destructive operations

Communication Guidelines:
- Use send tools for sharing **valuable intermediate content** (previews, files, progress with meaningful data)
- **AVOID** sending status updates like "Task started" - just do the work
- **AVOID** repeating yourself - if you already sent information, don't repeat it in your final response
- Keep your final text response **brief** if details were already sent

You are an expert assistant that can help with:
- Software development and coding
- System administration
- File management
- Sharing files and media via WhatsApp
- Any command-line task the user needs help with`

const SLACK_SYSTEM_PROMPT = `You are a helpful AI assistant. You are working together (cowork) with the user to accomplish tasks.

You have access to:
1. **Bash/Terminal** - Execute shell commands for file operations, git, npm, system info, etc.
2. **Text editor** - View and edit files with precision
3. **Slack messaging** - Send various types of content to the user via Slack:
   - Text messages (with mrkdwn formatting)
   - Rich Block Kit messages
   - File uploads
   - Reactions to messages
   - Thread replies

Guidelines:
- Use bash for command-line tasks, file operations, git, npm, etc.
- Use the text editor for viewing and editing code files
- Use Slack tools to send rich content (blocks, files, etc.) to the user
- Ask for confirmation before destructive operations

Communication Guidelines:
- Use send tools for sharing **valuable intermediate content** (previews, files, progress with meaningful data)
- **AVOID** sending status updates like "Task started" - just do the work
- **AVOID** repeating yourself - if you already sent information, don't repeat it in your final response
- Keep your final text response **brief** if details were already sent

You are an expert assistant that can help with:
- Software development and coding
- System administration
- File management
- Sharing files and media via Slack
- Any command-line task the user needs help with`

const LINE_SYSTEM_PROMPT = `You are a helpful AI assistant. You are working together (cowork) with the user to accomplish tasks.

You have access to:
1. **Bash/Terminal** - Execute shell commands for file operations, git, npm, system info, etc.
2. **Text editor** - View and edit files with precision
3. **Line messaging** - Send various types of content to the user via Line:
   - Text messages
   - Images
   - Stickers
   - Locations
   - Flex Messages (rich interactive cards)
   - Button templates

Guidelines:
- Use bash for command-line tasks, file operations, git, npm, etc.
- Use the text editor for viewing and editing code files
- Use Line tools to send rich content (images, stickers, flex messages, etc.) to the user
- Ask for confirmation before destructive operations

Communication Guidelines:
- Use send tools for sharing **valuable intermediate content** (previews, files, progress with meaningful data)
- **AVOID** sending status updates like "Task started" - just do the work
- **AVOID** repeating yourself - if you already sent information, don't repeat it in your final response
- Keep your final text response **brief** if details were already sent

You are an expert assistant that can help with:
- Software development and coding
- System administration
- File management
- Sharing files and media via Line
- Any command-line task the user needs help with`

const DEFAULT_SYSTEM_PROMPT = `You are a helpful AI assistant. You are working together (cowork) with the user to accomplish tasks.

You have access to:
1. **Bash/Terminal** - Execute shell commands for file operations, git, npm, system info, etc.
2. **Text editor** - View and edit files with precision

Guidelines:
- Use bash for command-line tasks, file operations, git, npm, etc.
- Use the text editor for viewing and editing code files
- Ask for confirmation before destructive operations
- **AVOID** repeating yourself - keep responses concise

You are an expert assistant that can help with:
- Software development and coding
- System administration
- File management
- Any command-line task the user needs help with`

/**
 * Create Anthropic client with current settings
 */
async function createClient(): Promise<{ client: Anthropic; model: string; maxTokens: number }> {
  const settings = await loadSettings()

  if (!settings.claudeApiKey) {
    throw new Error('Claude API key not configured. Please set it in Settings.')
  }

  const client = new Anthropic({
    apiKey: settings.claudeApiKey
  })

  return {
    client,
    model: settings.claudeModel,
    maxTokens: settings.maxTokens
  }
}

/**
 * Get tools for a specific platform
 */
function getToolsForPlatform(platform: MessagePlatform): Anthropic.Tool[] {
  const baseTools = [...computerUseTools]
  
  // Add platform-specific tools (macOS mail, calendar, etc.)
  const platformTools = getMacOSTools() // Returns empty array on non-macOS
  
  // Add MCP tools to all platforms
  const mcpTools = mcpService.getTools()
  
  // Service tools are available on all platforms
  const svcTools = [...serviceTools]
  
  switch (platform) {
    case 'telegram':
      return [...baseTools, ...platformTools, ...telegramTools, ...svcTools, ...mcpTools]
    case 'discord':
      return [...baseTools, ...platformTools, ...discordTools, ...svcTools, ...mcpTools]
    case 'whatsapp':
      return [...baseTools, ...platformTools, ...whatsappTools, ...svcTools, ...mcpTools]
    case 'slack':
      return [...baseTools, ...platformTools, ...slackTools, ...svcTools, ...mcpTools]
    case 'line':
      return [...baseTools, ...platformTools, ...lineTools, ...svcTools, ...mcpTools]
    case 'none':
    default:
      return [...baseTools, ...platformTools, ...svcTools, ...mcpTools]
  }
}

/**
 * Get the default output directory for agent-generated files
 */
function getDefaultOutputDir(): string {
  return path.join(app.getPath('userData'), 'agent-output')
}

/**
 * Get system prompt for a specific platform
 */
async function getSystemPromptForPlatform(platform: MessagePlatform): Promise<string> {
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
      case 'none':
      default:
        basePrompt = DEFAULT_SYSTEM_PROMPT
    }
  }
  
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
  try {
    const builtinSkillsDir = path.join(__dirname, '../builtin-skills')
    const builtinSkillPath = path.join(builtinSkillsDir, 'service-creator', 'SKILL.md')
    const builtinContent = await fs.readFile(builtinSkillPath, 'utf-8')
    basePrompt += '\n\n' + builtinContent
    console.log('[Agent] Loaded builtin skill: service-creator')
  } catch (error) {
    // Builtin skills may not exist in dev mode, try src path
    try {
      const devSkillPath = path.join(process.cwd(), 'src/main/builtin-skills/service-creator/SKILL.md')
      const devContent = await fs.readFile(devSkillPath, 'utf-8')
      basePrompt += '\n\n' + devContent
      console.log('[Agent] Loaded builtin skill from dev path: service-creator')
    } catch {
      console.log('[Agent] Builtin skills not found (this is ok in some environments)')
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
  
  return basePrompt
}

/**
 * AgentService handles conversation with Claude and tool execution
 * Supports Computer Use for full computer control
 */
export class AgentService {
  private conversationHistory: Anthropic.MessageParam[] = []
  private unmemorizedMessages: Anthropic.MessageParam[] = []
  private currentStatus: LLMStatusInfo = { status: 'idle' }
  private abortController: AbortController | null = null
  private isAborted = false
  private currentPlatform: MessagePlatform = 'none'
  private contextLoadedForPlatform: MessagePlatform | null = null // Track which platform's context is loaded
  private recentReplyPlatform: MessagePlatform = 'none' // Track which platform the user most recently sent a message from
  private processingLock: MessagePlatform | null = null // Global lock for processMessage - only one platform at a time

  /**
   * Get current LLM status
   */
  getStatus(): LLMStatusInfo {
    return this.currentStatus
  }

  /**
   * Get unmemorized messages and clear the array
   * Returns messages that have been added to conversation history but not yet memorized
   */
  getUnmemorizedMessages(): Anthropic.MessageParam[] {
    const messages = [...this.unmemorizedMessages]
    this.unmemorizedMessages = []
    return messages
  }

  /**
   * Get current platform
   */
  getCurrentPlatform(): MessagePlatform {
    return this.currentPlatform
  }

  /**
   * Get the platform from which the user most recently sent a message
   */
  getRecentReplyPlatform(): MessagePlatform {
    return this.recentReplyPlatform
  }

  /**
   * Update and emit status
   */
  private setStatus(status: LLMStatus, currentTool?: string, iteration?: number): void {
    this.currentStatus = { status, currentTool, iteration }
    appEvents.emitLLMStatusChanged(this.currentStatus)
  }

  /**
   * Abort the current processing
   */
  abort(): void {
    console.log('[Agent] Aborting current processing...')
    this.isAborted = true
    if (this.abortController) {
      this.abortController.abort()
    }
    this.setStatus('idle')
  }

  /**
   * Check if processing is currently active
   */
  isProcessing(): boolean {
    return this.processingLock !== null
  }

  /**
   * Get the platform currently holding the processing lock
   * Returns null if no processing is active
   */
  getProcessingLockPlatform(): MessagePlatform | null {
    return this.processingLock
  }

  /**
   * Check if a specific platform can start processing
   * Returns { canProcess: true } or { canProcess: false, busyWith: platform }
   */
  canProcess(platform: MessagePlatform): { canProcess: boolean; busyWith?: MessagePlatform } {
    if (this.processingLock === null) {
      return { canProcess: true }
    }
    if (this.processingLock === platform) {
      // Same platform trying to process again (shouldn't happen, but allow it)
      return { canProcess: true }
    }
    return { canProcess: false, busyWith: this.processingLock }
  }

  /**
   * Load historical context from storage for a specific platform
   */
  private async loadContextFromStorage(platform: MessagePlatform): Promise<void> {
    // Skip if platform is 'none'
    if (platform === 'none') {
      return
    }

    // If switching platforms, clear previous context and reload
    if (this.contextLoadedForPlatform !== null && this.contextLoadedForPlatform !== platform) {
      console.log(`[Agent] Platform switched from ${this.contextLoadedForPlatform} to ${platform}, clearing context...`)
      this.conversationHistory = []
      this.unmemorizedMessages = []
      this.contextLoadedForPlatform = null
    }

    // Skip if context already loaded for this platform
    if (this.contextLoadedForPlatform === platform) {
      return
    }

    console.log(`[Agent] Loading historical context for ${platform}...`)

    try {
      let messages: Array<{ text?: string; isFromBot: boolean }> = []

      if (platform === 'telegram') {
        const storedMessages = await telegramStorage.getMessages(MAX_CONTEXT_MESSAGES)
        messages = storedMessages.map(m => ({
          text: m.text,
          isFromBot: m.isFromBot
        }))
      } else if (platform === 'discord') {
        const storedMessages = await discordStorage.getMessages(MAX_CONTEXT_MESSAGES)
        messages = storedMessages.map(m => ({
          text: m.text,
          isFromBot: m.isFromBot
        }))
      } else if (platform === 'slack') {
        const storedMessages = await slackStorage.getMessages(MAX_CONTEXT_MESSAGES)
        messages = storedMessages.map(m => ({
          text: m.text,
          isFromBot: m.isFromBot
        }))
      }

      // Convert to Anthropic message format
      // We need to group consecutive messages from the same role
      if (messages.length > 0) {
        let lastRole: 'user' | 'assistant' | null = null
        
        for (const msg of messages) {
          if (!msg.text) continue
          
          const role: 'user' | 'assistant' = msg.isFromBot ? 'assistant' : 'user'
          
          // Anthropic API requires alternating user/assistant messages
          // If same role as last, append to previous or skip
          if (role === lastRole && this.conversationHistory.length > 0) {
            // Append to last message
            const lastMsg = this.conversationHistory[this.conversationHistory.length - 1]
            if (typeof lastMsg.content === 'string') {
              lastMsg.content = lastMsg.content + '\n\n' + msg.text
            }
          } else {
            this.conversationHistory.push({
              role,
              content: msg.text
            })
            lastRole = role
          }
        }
        
        console.log(`[Agent] Loaded ${this.conversationHistory.length} context messages`)
      }
    } catch (error) {
      console.error('[Agent] Error loading context:', error)
    }

    this.contextLoadedForPlatform = platform
  }

  /**
   * Process a user message and return the agent's response
   * This implements the agentic loop for computer use
   * @param userMessage The message from the user
   * @param platform The platform the message came from (affects available tools)
   * @param imageUrls Optional array of image URLs to include in the message
   */
  async processMessage(
    userMessage: string,
    platform: MessagePlatform = 'none',
    imageUrls: string[] = []
  ): Promise<AgentResponse> {
    // Check if another platform is currently processing
    const lockCheck = this.canProcess(platform)
    if (!lockCheck.canProcess) {
      console.log(`[Agent] Rejected: ${platform} cannot process, busy with ${lockCheck.busyWith}`)
      return {
        success: false,
        error: `busy:${lockCheck.busyWith}`,
        busyWith: lockCheck.busyWith
      }
    }

    // Acquire the processing lock
    this.processingLock = platform
    console.log(`[Agent] Lock acquired by ${platform}`)

    // Load historical context if this is a new session or platform changed
    if (platform !== 'none') {
      await this.loadContextFromStorage(platform)
    }

    // Reset abort state
    this.isAborted = false
    this.abortController = new AbortController()
    this.currentPlatform = platform
    
    // Track the platform the user most recently sent a message from
    if (platform !== 'none') {
      this.recentReplyPlatform = platform
    }

    try {
      console.log(`[Agent] Processing message from ${platform}:`, userMessage.substring(0, 50) + '...')
      console.log(`[Agent] Image URLs:`, imageUrls.length > 0 ? imageUrls : 'none')
      this.setStatus('thinking')

      // Check if the message is already in conversation history (loaded from storage)
      // This happens when storage is updated before calling processMessage
      const lastMessage = this.conversationHistory[this.conversationHistory.length - 1]
      const isAlreadyInHistory = lastMessage && 
        lastMessage.role === 'user' && 
        typeof lastMessage.content === 'string' && 
        lastMessage.content === userMessage

      if (isAlreadyInHistory) {
        console.log(`[Agent] Message already in history from storage, skipping duplicate add to conversationHistory`)
        // Still mark for memorization since it's a new incoming message
        this.unmemorizedMessages.push(lastMessage)
      } else {
        // Build message content with images if present
        if (imageUrls.length > 0) {
          // Create multimodal content with images and text
          const contentParts: Anthropic.ContentBlockParam[] = []
          
          // Add images first
          for (const imageUrl of imageUrls) {
            contentParts.push({
              type: 'image',
              source: {
                type: 'url',
                url: imageUrl
              }
            } as Anthropic.ImageBlockParam)
          }
          
          // Add text if present
          if (userMessage) {
            contentParts.push({
              type: 'text',
              text: userMessage
            })
          }
          
          const multimodalMessage: Anthropic.MessageParam = {
            role: 'user',
            content: contentParts
          }
          this.conversationHistory.push(multimodalMessage)
          this.unmemorizedMessages.push(multimodalMessage)
          console.log(`[Agent] Added multimodal message with ${imageUrls.length} images`)
        } else {
          // Text-only message
          const textMessage: Anthropic.MessageParam = {
            role: 'user',
            content: userMessage
          }
          this.conversationHistory.push(textMessage)
          this.unmemorizedMessages.push(textMessage)
        }
      }

      // Check if proactive service is waiting for user input
      // Use dynamic import to avoid circular dependency
      const { proactiveService } = await import('./proactive.service')
      if (proactiveService.isWaitingForUserInput()) {
        console.log('[Agent] Proactive service is waiting for user input, forwarding message')
        proactiveService.setUserInput(userMessage)
        this.setStatus('idle')
        return {
          success: true,
          message: '[Message forwarded to proactive service]'
        }
      }

      // Run the agentic loop
      const response = await this.runAgentLoop()

      // Set status back to idle
      this.setStatus('idle')
      return response
    } catch (error) {
      this.setStatus('idle')

      // Check if it was an abort
      if (this.isAborted) {
        console.log('[Agent] Processing was aborted')
        return {
          success: true,
          message: '[Processing stopped by user]'
        }
      }

      console.error('[Agent] Error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    } finally {
      this.abortController = null
      // Release the processing lock
      console.log(`[Agent] Lock released by ${this.processingLock}`)
      this.processingLock = null
    }
  }

  /**
   * Run the agentic loop until we get a final response
   */
  private async runAgentLoop(): Promise<AgentResponse> {
    // Create client with current settings (re-read each time in case settings changed)
    const { client, model, maxTokens } = await createClient()
    const systemPrompt = await getSystemPromptForPlatform(this.currentPlatform)
    const tools = getToolsForPlatform(this.currentPlatform)

    console.log(`[Agent] Using tools for platform: ${this.currentPlatform}`)
    console.log(`[Agent] Available tools: ${tools.map(t => t.name).join(', ')}`)

    let iterations = 0
    const maxIterations = 50 // Prevent infinite loops

    while (iterations < maxIterations) {
      // Check if aborted
      if (this.isAborted) {
        throw new Error('Aborted')
      }

      iterations++
      console.log(`[Agent] Loop iteration ${iterations}, model: ${model}`)
      this.setStatus('thinking', undefined, iterations)

      // Call Claude API with platform-specific tools
      const response = await client.messages.create({
        model,
        max_tokens: maxTokens,
        system: systemPrompt,
        tools,
        messages: this.conversationHistory
      })

      // Check if aborted after API call
      if (this.isAborted) {
        throw new Error('Aborted')
      }

      console.log('[Agent] Response received, stop_reason:', response.stop_reason)

      // Check if we need to use tools
      if (response.stop_reason === 'tool_use') {
        // Process tool calls
        await this.processToolUse(response)
      } else {
        // Extract final text response
        const textContent = response.content.find((block) => block.type === 'text')
        const message = textContent && textContent.type === 'text' ? textContent.text : ''

        // Add assistant response to history
        const assistantMessage: Anthropic.MessageParam = {
          role: 'assistant',
          content: response.content
        }
        this.conversationHistory.push(assistantMessage)
        this.unmemorizedMessages.push(assistantMessage)

        console.log('[Agent] Final response:', message.substring(0, 100) + '...')

        return {
          success: true,
          message
        }
      }
    }

    return {
      success: false,
      error: 'Max iterations reached'
    }
  }

  /**
   * Process tool use blocks and execute tools
   */
  private async processToolUse(response: Anthropic.Message): Promise<void> {
    // Check if aborted
    if (this.isAborted) {
      throw new Error('Aborted')
    }

    // Add assistant's response (with tool use) to history
    const assistantToolUseMessage: Anthropic.MessageParam = {
      role: 'assistant',
      content: response.content
    }
    this.conversationHistory.push(assistantToolUseMessage)
    this.unmemorizedMessages.push(assistantToolUseMessage)

    // Find all tool use blocks
    const toolUseBlocks = response.content.filter(
      (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
    )

    console.log('[Agent] Executing', toolUseBlocks.length, 'tool(s)')

    // Execute each tool and collect results
    const toolResults: Anthropic.ToolResultBlockParam[] = []

    for (const toolUse of toolUseBlocks) {
      // Check if aborted before each tool
      if (this.isAborted) {
        throw new Error('Aborted')
      }

      console.log('[Agent] Executing tool:', toolUse.name)
      this.setStatus('tool_executing', toolUse.name)
      const result = await this.executeTool(toolUse.name, toolUse.input)

      // Handle screenshot specially - include image in response
      if (toolUse.name === 'computer' && (toolUse.input as { action: string }).action === 'screenshot') {
        if (result.success && result.data && typeof result.data === 'object') {
          const screenshotData = result.data as { type: string; media_type: string; data: string }
          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolUse.id,
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: screenshotData.media_type as 'image/png',
                  data: screenshotData.data
                }
              },
              {
                type: 'text',
                text: 'Screenshot captured successfully'
              }
            ]
          })
        } else {
          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolUse.id,
            content: JSON.stringify(result),
            is_error: !result.success
          })
        }
      } else {
        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: JSON.stringify(result),
          is_error: !result.success
        })
      }
    }

    // Add tool results to history
    const toolResultsMessage: Anthropic.MessageParam = {
      role: 'user',
      content: toolResults
    }
    this.conversationHistory.push(toolResultsMessage)
    this.unmemorizedMessages.push(toolResultsMessage)
  }

  /**
   * Execute a single tool
   */
  private async executeTool(
    name: string,
    input: unknown
  ): Promise<{ success: boolean; data?: unknown; error?: string }> {
    // Computer use tools
    switch (name) {
      case 'computer':
        return await executeComputerTool(input as Parameters<typeof executeComputerTool>[0])

      case 'bash':
        return await executeBashTool(input as Parameters<typeof executeBashTool>[0])

      case 'str_replace_editor':
        return await executeTextEditorTool(input as Parameters<typeof executeTextEditorTool>[0])

      case 'download_file':
        return await executeDownloadFileTool(input as Parameters<typeof executeDownloadFileTool>[0])

      case 'web_search':
        return await executeWebSearchTool(input as Parameters<typeof executeWebSearchTool>[0])
    }

    // macOS-specific tools
    if (isMacOS()) {
      switch (name) {
        case 'macos_mail':
          return await executeMacOSMailTool(input as Parameters<typeof executeMacOSMailTool>[0])
        case 'macos_calendar':
          return await executeMacOSCalendarTool(input as Parameters<typeof executeMacOSCalendarTool>[0])
        case 'macos_contacts':
          return await executeMacOSContactsTool(input as Parameters<typeof executeMacOSContactsTool>[0])
      }
    }

    // Telegram tools
    if (name.startsWith('telegram_')) {
      if (this.currentPlatform !== 'telegram') {
        return { success: false, error: `Telegram tools are not available in ${this.currentPlatform} context` }
      }
      return await executeTelegramTool(name, input)
    }

    // Discord tools
    if (name.startsWith('discord_')) {
      if (this.currentPlatform !== 'discord') {
        return { success: false, error: `Discord tools are not available in ${this.currentPlatform} context` }
      }
      return await executeDiscordTool(name, input)
    }

    // WhatsApp tools
    if (name.startsWith('whatsapp_')) {
      if (this.currentPlatform !== 'whatsapp') {
        return { success: false, error: `WhatsApp tools are not available in ${this.currentPlatform} context` }
      }
      return await executeWhatsAppTool(name, input)
    }

    // Slack tools
    if (name.startsWith('slack_')) {
      if (this.currentPlatform !== 'slack') {
        return { success: false, error: `Slack tools are not available in ${this.currentPlatform} context` }
      }
      return await executeSlackTool(name, input)
    }

    // Line tools
    if (name.startsWith('line_')) {
      if (this.currentPlatform !== 'line') {
        return { success: false, error: `Line tools are not available in ${this.currentPlatform} context` }
      }
      return await executeLineTool(name, input)
    }

    // Service tools
    if (name.startsWith('service_')) {
      return await executeServiceTool(name, input)
    }

    // MCP tools
    if (mcpService.isMcpTool(name)) {
      return await mcpService.executeTool(name, input)
    }

    return { success: false, error: `Unknown tool: ${name}` }
  }

  /**
   * Get conversation history for display
   */
  getHistory(): ConversationMessage[] {
    const displayHistory: ConversationMessage[] = []

    for (const msg of this.conversationHistory) {
      if (msg.role === 'user' && typeof msg.content === 'string') {
        displayHistory.push({ role: 'user', content: msg.content })
      } else if (msg.role === 'assistant' && Array.isArray(msg.content)) {
        const textBlock = msg.content.find(
          (block): block is Anthropic.TextBlock => block.type === 'text'
        )
        if (textBlock) {
          displayHistory.push({ role: 'assistant', content: textBlock.text })
        }
      }
    }

    return displayHistory
  }

  /**
   * Clear conversation history
   */
  clearHistory(): void {
    this.conversationHistory = []
    this.unmemorizedMessages = []
    this.contextLoadedForPlatform = null
  }

  /**
   * Evaluate whether to notify user based on context and data
   * This is a single LLM call without tool use, designed for automated monitoring services
   * 
   * @param context User's original request and expectations
   * @param data Current event data to evaluate
   * @returns Evaluation decision with shouldNotify, message, and reason
   */
  async evaluate(
    context: EvaluationContext,
    data: EvaluationData
  ): Promise<{ success: boolean; decision?: EvaluationDecision; error?: string }> {
    try {
      console.log('[Agent] Evaluating notification request...')
      console.log('[Agent] User request:', context.userRequest.substring(0, 50) + '...')
      console.log('[Agent] Data summary:', data.summary.substring(0, 50) + '...')

      // Create client
      const { client, model, maxTokens } = await createClient()

      // Build the evaluation prompt
      const evaluationPrompt = this.buildEvaluationPrompt(context, data)

      // Single LLM call without tools
      const response = await client.messages.create({
        model,
        max_tokens: Math.min(maxTokens, 1024), // Limit tokens for evaluation
        system: `You are an evaluation assistant. Your job is to decide whether an event warrants notifying the user based on their stated expectations.

You MUST respond with a valid JSON object in this exact format:
{
  "shouldNotify": true or false,
  "message": "The notification message to send to user (only if shouldNotify is true)",
  "reason": "Brief explanation of your decision"
}

Guidelines:
- Be conservative: only notify when the event clearly matches user's expectations
- If shouldNotify is false, message can be omitted or empty
- Keep the notification message concise and actionable
- The reason should explain why you made this decision

IMPORTANT: Respond with ONLY the JSON object, no additional text.`,
        messages: [
          {
            role: 'user',
            content: evaluationPrompt
          }
        ]
      })

      // Extract text response
      const textContent = response.content.find((block) => block.type === 'text')
      if (!textContent || textContent.type !== 'text') {
        return { success: false, error: 'No text response from LLM' }
      }

      // Parse JSON response
      const responseText = textContent.text.trim()
      console.log('[Agent] Evaluation response:', responseText)

      try {
        // Try to extract JSON from response (handle potential markdown code blocks)
        let jsonStr = responseText
        const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
        if (jsonMatch) {
          jsonStr = jsonMatch[1]
        }

        const decision = JSON.parse(jsonStr) as EvaluationDecision

        // Validate decision structure
        if (typeof decision.shouldNotify !== 'boolean') {
          return { success: false, error: 'Invalid decision: shouldNotify must be boolean' }
        }
        if (typeof decision.reason !== 'string') {
          return { success: false, error: 'Invalid decision: reason must be string' }
        }
        if (decision.shouldNotify && typeof decision.message !== 'string') {
          return { success: false, error: 'Invalid decision: message required when shouldNotify is true' }
        }

        console.log('[Agent] Evaluation decision:', decision.shouldNotify ? 'NOTIFY' : 'IGNORE')
        return { success: true, decision }
      } catch (parseError) {
        console.error('[Agent] Failed to parse evaluation response:', parseError)
        return { success: false, error: `Failed to parse LLM response: ${responseText}` }
      }
    } catch (error) {
      console.error('[Agent] Evaluation error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  /**
   * Build the evaluation prompt for LLM
   */
  private buildEvaluationPrompt(context: EvaluationContext, data: EvaluationData): string {
    const metadataStr = data.metadata
      ? `\nAdditional Metadata:\n${JSON.stringify(data.metadata, null, 2)}`
      : ''

    return `Please evaluate whether the following event should trigger a notification to the user.

== USER'S ORIGINAL REQUEST ==
${context.userRequest}

== USER'S EXPECTATION ==
${context.expectation}

== CURRENT EVENT ==
Time: ${data.timestamp}
Summary: ${data.summary}
${data.details ? `Details: ${data.details}` : ''}${metadataStr}

Based on the user's expectations, should this event trigger a notification?`
  }
}

// Export singleton instance
export const agentService = new AgentService()
