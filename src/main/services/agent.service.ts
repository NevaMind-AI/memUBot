import Anthropic from '@anthropic-ai/sdk'
import path from 'path'
import { SocksProxyAgent } from 'socks-proxy-agent'
import { HttpsProxyAgent } from 'https-proxy-agent'
import fetch from 'node-fetch'
import { computerUseTools } from '../tools/computer.definitions'
import { telegramTools } from '../tools/telegram.definitions'
import { discordTools } from '../tools/discord.definitions'
import { whatsappTools } from '../tools/whatsapp.definitions'
import { slackTools } from '../tools/slack.definitions'
import { lineTools } from '../tools/line.definitions'
import { executeComputerTool, executeBashTool, executeTextEditorTool } from '../tools/computer.executor'
import { executeTelegramTool } from '../tools/telegram.executor'
import { executeDiscordTool } from '../tools/discord.executor'
import { executeWhatsAppTool } from '../tools/whatsapp.executor'
import { executeSlackTool } from '../tools/slack.executor'
import { executeLineTool } from '../tools/line.executor'
import { loadProxyConfig, buildProxyUrl } from '../config/proxy.config'
import { loadSettings } from '../config/settings.config'
import { appEvents } from '../events'
import { telegramStorage } from '../apps/telegram/storage'
import { discordStorage } from '../apps/discord/storage'
import { slackStorage } from '../apps/slack/storage'
import { app } from 'electron'
import { mcpService } from './mcp.service'
import { skillsService } from './skills.service'
import type { ConversationMessage, AgentResponse } from '../types'

/**
 * Maximum number of historical messages to load as context
 */
const MAX_CONTEXT_MESSAGES = 20

/**
 * Supported platforms for messaging tools
 */
export type MessagePlatform = 'telegram' | 'discord' | 'whatsapp' | 'slack' | 'line' | 'none'

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
- Explain what you're doing and why
- Ask for confirmation before destructive operations

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
- Explain what you're doing and why
- Ask for confirmation before destructive operations

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
- Explain what you're doing and why
- Ask for confirmation before destructive operations

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
- Explain what you're doing and why
- Ask for confirmation before destructive operations

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
- Explain what you're doing and why
- Ask for confirmation before destructive operations

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
- Explain what you're doing and why
- Ask for confirmation before destructive operations

You are an expert assistant that can help with:
- Software development and coding
- System administration
- File management
- Any command-line task the user needs help with`

/**
 * Create a custom fetch function with proxy support
 */
async function createProxyFetch(): Promise<typeof globalThis.fetch | undefined> {
  const proxyConfig = await loadProxyConfig()
  const proxyUrl = buildProxyUrl(proxyConfig)

  if (!proxyUrl) {
    console.log('[Agent] No proxy configured, using default fetch')
    return undefined
  }

  console.log('[Agent] Creating proxy fetch with:', proxyUrl)

  // Create appropriate proxy agent based on type
  const agent =
    proxyConfig.type === 'socks5' ? new SocksProxyAgent(proxyUrl) : new HttpsProxyAgent(proxyUrl)

  // Return custom fetch function with proxy agent
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const proxyFetch = async (url: any, init?: any): Promise<any> => {
    const options = {
      ...init,
      agent
    }
    return fetch(url, options)
  }

  return proxyFetch as typeof globalThis.fetch
}

/**
 * Create Anthropic client with current settings
 */
async function createClient(): Promise<{ client: Anthropic; model: string; maxTokens: number }> {
  const settings = await loadSettings()
  const customFetch = await createProxyFetch()

  if (!settings.claudeApiKey) {
    throw new Error('Claude API key not configured. Please set it in Settings.')
  }

  const clientOptions: { apiKey: string; fetch?: typeof globalThis.fetch } = {
    apiKey: settings.claudeApiKey
  }

  if (customFetch) {
    console.log('[Agent] Using proxy-enabled fetch')
    clientOptions.fetch = customFetch as unknown as typeof globalThis.fetch
  } else {
    console.log('[Agent] Using default Anthropic client')
  }

  const client = new Anthropic(clientOptions)

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
  
  // Add MCP tools to all platforms
  const mcpTools = mcpService.getTools()
  
  switch (platform) {
    case 'telegram':
      return [...baseTools, ...telegramTools, ...mcpTools]
    case 'discord':
      return [...baseTools, ...discordTools, ...mcpTools]
    case 'whatsapp':
      return [...baseTools, ...whatsappTools, ...mcpTools]
    case 'slack':
      return [...baseTools, ...slackTools, ...mcpTools]
    case 'line':
      return [...baseTools, ...lineTools, ...mcpTools]
    case 'none':
    default:
      return [...baseTools, ...mcpTools]
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

Important rules:
- Always use this directory for generated files unless the user explicitly specifies a different path
- If the user mentions a specific location (e.g., "save to Desktop", "copy to ~/Downloads"), use that location instead
- Create subdirectories within this path as needed to organize files (e.g., images/, documents/, code/)
- When sending files to the user, always use absolute paths starting with this directory`

  basePrompt += outputDirInstruction
  
  // Append enabled skills content
  try {
    const skillsContent = await skillsService.getEnabledSkillsContent()
    if (skillsContent) {
      console.log('[Agent] Loaded skills content, length:', skillsContent.length)
      basePrompt += skillsContent
    } else {
      console.log('[Agent] No enabled skills to load')
    }
  } catch (error) {
    console.error('[Agent] Failed to load skills:', error)
  }
  
  return basePrompt
}

/**
 * AgentService handles conversation with Claude and tool execution
 * Supports Computer Use for full computer control
 */
export class AgentService {
  private conversationHistory: Anthropic.MessageParam[] = []
  private currentStatus: LLMStatusInfo = { status: 'idle' }
  private abortController: AbortController | null = null
  private isAborted = false
  private currentPlatform: MessagePlatform = 'none'
  private contextLoadedForPlatform: MessagePlatform | null = null // Track which platform's context is loaded
  private currentImageUrls: string[] = []

  /**
   * Get current LLM status
   */
  getStatus(): LLMStatusInfo {
    return this.currentStatus
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
    return this.currentStatus.status !== 'idle'
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
    // Load historical context if this is a new session or platform changed
    if (platform !== 'none') {
      await this.loadContextFromStorage(platform)
    }

    // Reset abort state
    this.isAborted = false
    this.abortController = new AbortController()
    this.currentPlatform = platform
    
    // Store image URLs for this message
    this.currentImageUrls = imageUrls

    try {
      console.log(`[Agent] Processing message from ${platform}:`, userMessage.substring(0, 50) + '...')
      console.log(`[Agent] Image URLs:`, imageUrls.length > 0 ? imageUrls : 'none')
      this.setStatus('thinking')

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
        
        this.conversationHistory.push({
          role: 'user',
          content: contentParts
        })
        console.log(`[Agent] Added multimodal message with ${imageUrls.length} images`)
      } else {
        // Text-only message
        this.conversationHistory.push({
          role: 'user',
          content: userMessage
        })
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
        this.conversationHistory.push({
          role: 'assistant',
          content: response.content
        })

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
    this.conversationHistory.push({
      role: 'assistant',
      content: response.content
    })

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
    this.conversationHistory.push({
      role: 'user',
      content: toolResults
    })
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
    this.contextLoadedForPlatform = null
  }
}

// Export singleton instance
export const agentService = new AgentService()
