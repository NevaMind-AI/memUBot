import Anthropic from '@anthropic-ai/sdk'
import { SocksProxyAgent } from 'socks-proxy-agent'
import { HttpsProxyAgent } from 'https-proxy-agent'
import fetch from 'node-fetch'
import { computerUseTools } from '../tools/computer.definitions'
import { telegramTools } from '../tools/telegram.definitions'
import { executeComputerTool, executeBashTool, executeTextEditorTool } from '../tools/computer.executor'
import { executeTelegramTool } from '../tools/telegram.executor'
import { loadProxyConfig, buildProxyUrl } from '../config/proxy.config'
import { loadSettings } from '../config/settings.config'
import { appEvents } from '../events'
import type { ConversationMessage, AgentResponse } from '../types'

/**
 * LLM processing status
 */
export type LLMStatus = 'idle' | 'thinking' | 'tool_executing'

export interface LLMStatusInfo {
  status: LLMStatus
  currentTool?: string
  iteration?: number
}

const DEFAULT_SYSTEM_PROMPT = `You are a helpful AI assistant with full control over the user's computer. You are working together (cowork) with the user to accomplish tasks.

You have access to:
1. **Computer control** - Take screenshots, move mouse, click, type, press keys, scroll
2. **Bash/Terminal** - Execute any shell commands
3. **Text editor** - View and edit files with precision
4. **Telegram messaging** - Send various types of content to the user via Telegram:
   - Text messages (with Markdown/HTML formatting)
   - Photos, videos, audio files, voice messages
   - Documents/files of any type
   - Locations, contacts, polls, stickers

Guidelines:
- Always take a screenshot first to understand the current state of the screen
- Be precise with mouse coordinates - the screen resolution is available after taking a screenshot
- For clicking UI elements, take a screenshot first to locate them
- Use bash for command-line tasks, file operations, git, npm, etc.
- Use the text editor for viewing and editing code files
- Use Telegram tools to send rich content (images, files, etc.) to the user
- Explain what you're doing and why
- Ask for confirmation before destructive operations

You are an expert assistant that can help with:
- Software development and coding
- System administration
- File management
- Web browsing and automation
- Sharing files and media via Telegram
- Any computer task the user needs help with`

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
async function createClient(): Promise<{ client: Anthropic; model: string; maxTokens: number; systemPrompt: string }> {
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
  const systemPrompt = settings.systemPrompt || DEFAULT_SYSTEM_PROMPT

  return {
    client,
    model: settings.claudeModel,
    maxTokens: settings.maxTokens,
    systemPrompt
  }
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
   * Process a user message and return the agent's response
   * This implements the agentic loop for computer use
   */
  async processMessage(userMessage: string): Promise<AgentResponse> {
    // Reset abort state
    this.isAborted = false
    this.abortController = new AbortController()

    try {
      console.log('[Agent] Processing message:', userMessage.substring(0, 50) + '...')
      this.setStatus('thinking')

      // Add user message to history
      this.conversationHistory.push({
        role: 'user',
        content: userMessage
      })

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
    const { client, model, maxTokens, systemPrompt } = await createClient()

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

      // Call Claude API with computer use and telegram tools
      const response = await client.messages.create({
        model,
        max_tokens: maxTokens,
        system: systemPrompt,
        tools: [...computerUseTools, ...telegramTools],
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
      return await executeTelegramTool(name, input)
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
  }
}

// Export singleton instance
export const agentService = new AgentService()
