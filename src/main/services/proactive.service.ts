import Anthropic from '@anthropic-ai/sdk'
import { loadSettings } from '../config/settings.config'
import { agentService, type MessagePlatform } from './agent.service'
import { proactiveStorage } from './proactive.storage'
import { infraService, type IncomingMessageEvent, type OutgoingMessageEvent } from './infra.service'
import { computerUseTools } from '../tools/computer.definitions'
import { executeComputerTool, executeBashTool, executeTextEditorTool, executeDownloadFileTool, executeWebSearchTool } from '../tools/computer.executor'
import { getMacOSTools, isMacOS } from '../tools/macos/definitions'
import { executeMacOSLaunchAppTool, executeMacOSMailTool, executeMacOSCalendarTool, executeMacOSContactsTool } from '../tools/macos/executor'
import { mcpService } from './mcp.service'
import { telegramBotService } from '../apps/telegram/bot.service'
import { discordBotService } from '../apps/discord/bot.service'
import { slackBotService } from '../apps/slack/bot.service'
import { whatsappBotService } from '../apps/whatsapp/bot.service'
import { lineBotService } from '../apps/line/bot.service'
import type { AgentResponse } from '../types'

/**
 * Default polling interval in milliseconds
 */
const DEFAULT_INTERVAL_MS = 30000

/**
 * Polling interval for checking user input
 */
const USER_INPUT_POLL_INTERVAL_MS = 1000

/**
 * Maximum time to wait for user input (10 minutes)
 */
const USER_INPUT_MAX_WAIT_MS = 10 * 60 * 1000

/**
 * Size of the context message window
 */
const contextMessageWindowSize = 20

/**
 * Memu tools definitions for memory retrieval
 */
const memuTools: Anthropic.Tool[] = [
  {
    name: 'memu_memory',
    description: 'Retrieve memory based on a query. Use this to recall past conversations, facts, or context about the user.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string',
          description: 'The query to search memory for'
        }
      },
      required: ['query']
    }
  },
  {
    name: 'memu_todos',
    description: 'Retrieve todos for the user. Returns a list of pending tasks and their summaries.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: []
    }
  },
  {
    name: 'wait_user_confirm',
    description: 'Wait for user input/confirmation before proceeding. Use this when you need user feedback, approval, or additional information before continuing with a task. The tool will block until the user responds.',
    input_schema: {
      type: 'object' as const,
      properties: {
        prompt: {
          type: 'string',
          description: 'The message/question to show the user while waiting for their input'
        }
      },
      required: ['prompt']
    }
  }
]

/**
 * System prompt for proactive agent handling todos
 */
const PROACTIVE_SYSTEM_PROMPT = `You are a helpful AI assistant working in an autonomous mode.

You now have two main jobs:
1. If the context messages suggest that the user and their assistant are working on some local files, you may give some suggestions to the user for file consolidation, such as:
  - Collect related files into folders.
  - Delete duplicate files.
  - Delete temporary files that are no longer needed.
2. If the context messages suggest there is a incoming email, you should give some suggestions for how to handle it, such as:
  - Reply to the email.
  - Mark the email as read.
  - Mark the email as important.

You have access to:
1. **Bash/Terminal** - Execute shell commands for file operations, git, npm, system info, etc.
2. **Text editor** - View and edit files with precision
3. **Memory retrieval** - Retrieve basic information about the user.
5. **User confirmation** - Wait for user input when you need feedback or approval

Guidelines:
- When you decide to perform or have finished some operations, you should mention it as a text message to the user.
- We generally want to make the user be less disturbed, so if you find there's no job to do for now (which is very common), you should respond with exactly "[NO_MESSAGE]" (no extra text), and there's no need to explain the reason.
- Critical: If an operation is destructive or irreversible (e.g. deleting files, sending emails, etc.), you must use the wait_user_confirm tool to wait for user confirmation before proceeding.`

/**
 * Proactive Service
 * Background task that checks for context updates and processes them when idle
 */
class ProactiveService {
  private isRunning = false
  private tickIntervalMs = DEFAULT_INTERVAL_MS
  private contextMessages: Anthropic.MessageParam[] = []
  private hasNewContextMessages = false
  private agentLoopMessages: Anthropic.MessageParam[] = []
  private isWaitingUserInput = false
  private waitingUserInputFromPlatform: MessagePlatform | null = null
  private userInput: string | null = null

  // Email monitoring state
  private lastEmailContent: string | null = null

  // InfraService subscription
  private unsubscribeFromInfra: (() => void)[] = []

  /**
   * Get memu configuration from settings
   */
  private async getMemuConfig(): Promise<{
    baseUrl: string
    apiKey: string
    userId: string
    agentId: string
    proactiveUserId: string
    proactiveAgentId: string
  }> {
    const settings = await loadSettings()
    return {
      baseUrl: settings.memuBaseUrl,
      apiKey: settings.memuApiKey,
      userId: settings.memuUserId,
      agentId: settings.memuAgentId,
      proactiveUserId: settings.memuProactiveUserId,
      proactiveAgentId: settings.memuProactiveAgentId,
    }
  }

  /**
   * Check if the proactive service is waiting for user input
   */
  isWaitingForUserInput(): boolean {
    return this.isWaitingUserInput
  }

  /**
   * Get the platform from which we're waiting for user input
   */
  getWaitingPlatform(): MessagePlatform | null {
    return this.waitingUserInputFromPlatform
  }

  /**
   * Set user input (called by InfraService when user responds)
   */
  setUserInput(input: string): void {
    console.log('[Proactive] User input received:', input.substring(0, 50) + (input.length > 50 ? '...' : ''))
    this.userInput = input
  }

  /**
   * Get available tools for proactive service
   * Includes: base tools, platform tools (macOS), MCP tools, and memu tools
   * Note: Messaging platform tools (telegram, discord, etc.) are NOT enabled
   */
  private getTools(): Anthropic.Tool[] {
    const baseTools = [...computerUseTools]
    const platformTools = getMacOSTools() // Returns empty array on non-macOS
    const mcpTools = mcpService.getTools()
    
    return [...baseTools, ...platformTools, ...mcpTools, ...memuTools]
  }

  /**
   * Execute memu_memory tool
   * This tool use main user/agent ids to retrieve memory from the main service.
   */
  private async executeMemuMemory(query: string): Promise<{ success: boolean; data?: unknown; error?: string }> {
    try {
      const memuConfig = await this.getMemuConfig()
      const response = await fetch(`${memuConfig.baseUrl}/api/v3/memory/retrieve`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${memuConfig.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          user_id: memuConfig.userId,
          agent_id: memuConfig.agentId,
          query
        })
      })
      const result = await response.json()
      return { success: true, data: result }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  }

  /**
   * Execute memu_todos tool to get todos
   * This tool use proactive user/agent ids to retrieve todos from the proactive service.
   */
  private async executeMemuTodos(): Promise<{ success: boolean; data?: unknown; error?: string }> {
    try {
      const memuConfig = await this.getMemuConfig()
      const response = await fetch(`${memuConfig.baseUrl}/api/v3/memory/categories`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${memuConfig.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          user_id: memuConfig.proactiveUserId,
          agent_id: memuConfig.proactiveAgentId
        })
      })
      const result = await response.json() as { categories: Array<{ name: string; summary: string }> }
      
      // Extract todos from categories
      let todos = ''
      for (const category of result.categories || []) {
        if (category.name === 'todo') {
          todos = category.summary
          break
        }
      }
      
      return { success: true, data: { todos } }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  }

  /**
   * Execute wait_user_confirm tool
   * Sets isWaitingUserInput flag and waits until userInput is provided
   */
  private async executeWaitUserConfirm(prompt: string): Promise<{ success: boolean; data?: unknown; error?: string }> {
    console.log(`[Proactive] Waiting for user confirmation: ${prompt}`)

    if (prompt.length > 0) {
      const sentPlatform = await this.sendToCurrentPlatform(prompt)
      if (sentPlatform) {
        this.waitingUserInputFromPlatform = sentPlatform
      }
      else {
        return { success: false, error: 'Failed to send prompt to platform' }
      }
    }
    else {
      return { success: false, error: 'No prompt provided' }
    }

    // Set waiting state and clear previous input
    this.isWaitingUserInput = true
    this.userInput = null
    
    // Poll interval for checking user input
    const startTime = Date.now()
    
    try {
      // Wait until userInput is set or timeout
      while (this.userInput === null) {
        if (Date.now() - startTime > USER_INPUT_MAX_WAIT_MS) {
          console.log('[Proactive] User confirmation timed out')
          return { success: false, error: 'Timeout waiting for user input' }
        }
        
        await new Promise(resolve => setTimeout(resolve, USER_INPUT_POLL_INTERVAL_MS))
      }
      
      // TypeScript needs help knowing userInput is definitely a string here
      const response: string = this.userInput as string
      console.log(`[Proactive] User confirmed with: ${response.substring(0, 50)}${response.length > 50 ? '...' : ''}`)
      
      return { success: true, data: { user_response: response } }
    } finally {
      // Always reset waiting state
      this.isWaitingUserInput = false
      this.waitingUserInputFromPlatform = null
      this.userInput = null
    }
  }

  /**
   * Start the background polling loop
   * Will not start if memuApiKey is not configured
   */
  async start(intervalMs: number = DEFAULT_INTERVAL_MS): Promise<boolean> {
    if (this.isRunning) {
      console.log('[Proactive] Service already running')
      return true
    }

    // Check if memuApiKey is configured
    // const settings = await loadSettings()
    // const memuApiKey = settings.memuApiKey
    // if (!memuApiKey || memuApiKey.trim() === '') {
    //   console.log('[Proactive] memuApiKey not configured, service will not start')
    //   console.log('[Proactive] Please configure memuApiKey in settings and call start() again')
    //   return false
    // }

    console.log(`[Proactive] Starting service with ${intervalMs}ms interval`)
    this.isRunning = true
    this.tickIntervalMs = intervalMs

    // Subscribe to infraService for real-time message notifications
    this.unsubscribeFromInfra.push(
      infraService.subscribe('message:incoming', (event) => {
        this.handleIncomingMessage(event)
      })
    )
    this.unsubscribeFromInfra.push(
      infraService.subscribe('message:outgoing', (event) => {
        this.handleOutgoingMessage(event)
      })
    )
    console.log('[Proactive] Subscribed to infraService for incoming messages')

    // Start the tick loop using setTimeout self-scheduling
    // First tick will happen after intervalMs
    this.scheduleTick()

    return true
  }

  /**
   * Schedule the next tick using setTimeout
   * This ensures ticks run sequentially with a fixed delay AFTER each completion
   */
  private scheduleTick(): void {
    if (!this.isRunning) {
      console.log('[Proactive] Service stopped, not scheduling next tick')
      return
    }

    setTimeout(async () => {
      if (!this.isRunning) {
        console.log('[Proactive] Service stopped during wait, not executing tick')
        return
      }

      await this.tick()
      
      // Schedule next tick after this one completes
      this.scheduleTick()
    }, this.tickIntervalMs)
  }

  /**
   * Stop the background polling loop
   * The next scheduled tick will see isRunning=false and stop the loop
   */
  stop(): void {
    if (!this.isRunning) {
      console.log('[Proactive] Service not running')
      return
    }

    console.log('[Proactive] Stopping service')
    
    // Setting isRunning to false will stop the setTimeout loop naturally
    this.isRunning = false
    
    // Unsubscribe from infraService
    if (this.unsubscribeFromInfra.length > 0) {
      this.unsubscribeFromInfra.forEach(unsub => unsub())
      this.unsubscribeFromInfra = []
      console.log('[Proactive] Unsubscribed from infraService')
    }
    
    console.log('[Proactive] Service stopped (pending tick will be cancelled)')
  }

  /**
   * Check if service is currently running
   */
  isActive(): boolean {
    return this.isRunning
  }

  /**
   * Handle incoming message from infraService subscription
   * This is called in real-time when any platform publishes a new message
   */
  private handleIncomingMessage(event: IncomingMessageEvent): void {
    console.log(`[Proactive] Received message via infraService from ${event.platform}`)
    this.contextMessages.push(event.message)
    if (this.contextMessages.length > contextMessageWindowSize) {
      this.contextMessages.shift()
    }
    this.hasNewContextMessages = true
  }

  private handleOutgoingMessage(event: OutgoingMessageEvent): void {
    console.log(`[Proactive] Received outgoing message via infraService from ${event.platform}`)
    this.contextMessages.push(event.message)
    if (this.contextMessages.length > contextMessageWindowSize) {
      this.contextMessages.shift()
    }
    this.hasNewContextMessages = true
  }

  /**
   * Check for new emails via Apple Mail (macOS only)
   * Reads the latest email (index=1) from INBOX of account 1.
   * On first run, records the email content without appending.
   * On subsequent runs, if the email differs from the last record, appends it as a fake user message.
   */
  private async checkNewEmails(): Promise<void> {
    if (!isMacOS()) {
      return
    }

    try {
      const result = await executeMacOSMailTool({ action: 'read_email', index: 1 })

      if (!result.success || !result.data) {
        console.log('[Proactive] Failed to read latest email:', result.error)
        return
      }

      const emailContent = (result.data as { content: string }).content

      // First run: just record and skip
      if (this.lastEmailContent === null) {
        console.log('[Proactive] First email check - recording latest email')
        this.lastEmailContent = emailContent
        return
      }

      // Compare with last recorded email
      if (emailContent === this.lastEmailContent) {
        console.log('[Proactive] No new email detected')
        return
      }

      // New email detected - update record and append as user message
      console.log('[Proactive] New email detected, appending to context messages')
      this.lastEmailContent = emailContent

      const fakeUserMessage: Anthropic.MessageParam = {
        role: 'user',
        content: `Here's a new email.\n\n${emailContent}`
      }

      this.contextMessages.push(fakeUserMessage)
      if (this.contextMessages.length > contextMessageWindowSize) {
        this.contextMessages.shift()
      }
      this.hasNewContextMessages = true
    } catch (error) {
      console.error('[Proactive] Error checking new emails:', error)
    }
  }

  /**
   * Single tick of the polling loop
   * With setTimeout self-scheduling, ticks are guaranteed to run sequentially
   * (next tick only starts after previous one completes + interval delay)
   */
  private async tick(): Promise<void> {
    try {
      // Step 0: Check for new emails
      await this.checkNewEmails()

      // Step 1: Check if AgentService is idle
      const agentStatus = agentService.getStatus()
      if (agentStatus.status !== 'idle' && agentStatus.status !== 'complete') {
        console.log(`[Proactive] Agent is ${agentStatus.status}, skipping this tick`)
        return
      }

      if (this.hasNewContextMessages) {
        console.log(`[Proactive] Found ${this.contextMessages.length} new context messages, triggering agent loop`)
        this.hasNewContextMessages = false
        await this.runAgentLoop()
      }
      
    } catch (error) {
      // Log error but don't stop the loop
      console.error('[Proactive] Error in tick:', error)
    }
    // No need for finally block - setTimeout scheduling handles sequential execution
  }

  /**
   * Create Anthropic client with current settings
   * Supports multiple providers: Claude, MiniMax, or custom Anthropic-compatible API
   */
  private async createClient(): Promise<{ client: Anthropic; model: string; maxTokens: number }> {
    const settings = await loadSettings()
    const provider = settings.llmProvider || 'claude'

    // Get API key and base URL based on provider
    let apiKey: string
    let baseURL: string | undefined
    let model: string

    switch (provider) {
      case 'claude':
        apiKey = settings.claudeApiKey
        baseURL = undefined
        model = settings.claudeModel || 'claude-sonnet-4-20250514'
        break
      case 'minimax':
        apiKey = settings.minimaxApiKey
        baseURL = 'https://api.minimaxi.com/anthropic'
        model = settings.minimaxModel || 'MiniMax-M2.1'
        break
      case 'zenmux':
        apiKey = settings.zenmuxApiKey
        baseURL = 'https://zenmux.ai/api/anthropic'
        model = settings.zenmuxModel
        break
      case 'custom':
        apiKey = settings.customApiKey
        baseURL = settings.customBaseUrl || undefined
        model = settings.customModel
        break
      default:
        apiKey = settings.claudeApiKey
        model = settings.claudeModel
    }

    if (!apiKey) {
      throw new Error(`API key not configured for ${provider}. Please set it in Settings.`)
    }

    const client = new Anthropic({
      apiKey,
      ...(baseURL && { baseURL })
    })

    console.log(`[Proactive] Using LLM provider: ${provider}, model: ${model}`)

    return {
      client,
      model,
      maxTokens: settings.maxTokens || 4096
    }
  }

  /**
   * Run the agent loop to process context messages
   */
  private async runAgentLoop(): Promise<AgentResponse> {
    const { client, model, maxTokens } = await this.createClient()
    const tools = this.getTools()

    console.log('[Proactive] Starting agent loop')
    console.log(`[Proactive] Available tools: ${tools.map(t => t.name).join(', ')}`)

    let iterations = 0
    const maxIterations = 50 // Prevent infinite loops

    // Snapshot contextMessages as the starting point (no window size limit from here on)
    this.agentLoopMessages = [...this.contextMessages]
    console.log(`[Proactive] Initialized agentLoopMessages with ${this.agentLoopMessages.length} context messages`)

    // Ensure first message is from user (sliding window may have dropped the leading user message)
    while (this.agentLoopMessages.length > 0 && this.agentLoopMessages[0].role === 'assistant') {
      this.agentLoopMessages.shift()
    }

    // Ensure last message is from user before calling API
    const lastMsg = this.agentLoopMessages[this.agentLoopMessages.length - 1]
    if (lastMsg?.role === 'assistant') {
      this.agentLoopMessages.push({
        role: 'user',
        content: 'Please continue adhering to the system prompt.'
      })
    }

    while (iterations < maxIterations) {
      iterations++
      console.log(`[Proactive] Loop iteration ${iterations}, model: ${model}`)

      // Call Claude API
      const response = await client.messages.create({
        model,
        max_tokens: maxTokens,
        system: PROACTIVE_SYSTEM_PROMPT,
        tools,
        messages: this.agentLoopMessages
      })

      console.log('[Proactive] Response received, stop_reason:', response.stop_reason)

      // Check if we need to use tools
      if (response.stop_reason === 'tool_use') {
        // Process tool calls
        await this.processToolUse(response)
      } else {
        // Extract final text response, converting sentinel token to empty string
        const textContent = response.content.find((block) => block.type === 'text')
        const rawMessage = textContent && textContent.type === 'text' ? textContent.text : ''
        const message = rawMessage.trim() === '[NO_MESSAGE]' ? '' : rawMessage

        // Add assistant response to agentLoopMessages
        const assistantMessage: Anthropic.MessageParam = {
          role: 'assistant',
          content: response.content
        }
        this.agentLoopMessages.push(assistantMessage)

        console.log('[Proactive] Final response:', message.substring(0, 100) + '...')

        // Send message to current platform if one is active
        let sentPlatform: MessagePlatform | null = null
        if (message) {
          const platform = await this.sendToCurrentPlatform(message)
          if (platform) {
            sentPlatform = platform
          }
        }

        // Store with platform info if it was sent successfully
        if (sentPlatform) {
          await proactiveStorage.storeMessage(assistantMessage, sentPlatform)
          // Invalidate main agent's cached context so it reloads from storage
          // on the next user message and sees this proactive message
          agentService.invalidateContextForPlatform(sentPlatform)
        }

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
   * Appends assistant response and tool results to agentLoopMessages
   */
  private async processToolUse(response: Anthropic.Message): Promise<void> {
    // Add assistant's response (with tool use) to agentLoopMessages
    const assistantMessage: Anthropic.MessageParam = {
      role: 'assistant',
      content: response.content
    }
    this.agentLoopMessages.push(assistantMessage)
    await proactiveStorage.storeMessage(assistantMessage)

    // Find all tool use blocks
    const toolUseBlocks = response.content.filter(
      (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
    )

    console.log('[Proactive] Executing', toolUseBlocks.length, 'tool(s)')

    // Execute each tool and collect results
    const toolResults: Anthropic.ToolResultBlockParam[] = []

    for (const toolUse of toolUseBlocks) {
      console.log('[Proactive] Executing tool:', toolUse.name)
      const result = await this.executeTool(toolUse.name, toolUse.input)

      toolResults.push({
        type: 'tool_result',
        tool_use_id: toolUse.id,
        content: JSON.stringify(result),
        is_error: !result.success
      })
    }

    // Add tool results to agentLoopMessages
    const toolResultsMessage: Anthropic.MessageParam = {
      role: 'user',
      content: toolResults
    }
    this.agentLoopMessages.push(toolResultsMessage)
    await proactiveStorage.storeMessage(toolResultsMessage)
  }

  /**
   * Execute a single tool
   * Supports: computer use tools, macOS tools, MCP tools, and memu tools
   * Note: Messaging platform tools (telegram, discord, etc.) are NOT supported
   */
  private async executeTool(
    name: string,
    input: unknown
  ): Promise<{ success: boolean; data?: unknown; error?: string }> {
    console.log(`[Proactive] Executing tool: ${name}`)

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
        case 'macos_launch_app':
          return await executeMacOSLaunchAppTool(input as Parameters<typeof executeMacOSLaunchAppTool>[0])
        case 'macos_mail':
          return await executeMacOSMailTool(input as Parameters<typeof executeMacOSMailTool>[0])
        case 'macos_calendar':
          return await executeMacOSCalendarTool(input as Parameters<typeof executeMacOSCalendarTool>[0])
        case 'macos_contacts':
          return await executeMacOSContactsTool(input as Parameters<typeof executeMacOSContactsTool>[0])
      }
    }

    // Memu tools
    switch (name) {
      case 'memu_memory': {
        const args = input as { query: string }
        return await this.executeMemuMemory(args.query)
      }

      case 'memu_todos': {
        return await this.executeMemuTodos()
      }

      case 'wait_user_confirm': {
        const args = input as { prompt: string }
        return await this.executeWaitUserConfirm(args.prompt)
      }
    }

    // MCP tools
    if (mcpService.isMcpTool(name)) {
      return await mcpService.executeTool(name, input)
    }

    return { success: false, error: `Unknown tool: ${name}` }
  }

  /**
   * Send a message to the current active platform
   * @param message The text message to send
   * @returns true if sent successfully, false otherwise
   */
  private async sendToCurrentPlatform(message: string): Promise<MessagePlatform | null> {
    const platform = agentService.getRecentReplyPlatform()
    
    if (platform === 'none') {
      console.log('[Proactive] No active platform, skipping message send')
      return null
    }

    console.log(`[Proactive] Sending message to ${platform}`)
    this.waitingUserInputFromPlatform = platform

    try {
      switch (platform) {
        case 'telegram': {
          const chatId = telegramBotService.getCurrentChatId()
          if (!chatId) {
            console.log('[Proactive] No current Telegram chat ID')
            return null
          }
          const result = await telegramBotService.sendText(chatId, message)
          if (result.success) {
            console.log('[Proactive] Message sent to Telegram successfully')
            return platform
          }
          console.error('[Proactive] Failed to send to Telegram:', result.error)
          return null
        }

        case 'discord': {
          const channelId = discordBotService.getCurrentChannelId()
          if (!channelId) {
            console.log('[Proactive] No current Discord channel ID')
            return null
          }
          const result = await discordBotService.sendText(channelId, message)
          if (result.success) {
            console.log('[Proactive] Message sent to Discord successfully')
            return platform
          }
          console.error('[Proactive] Failed to send to Discord:', result.error)
          return null
        }

        case 'slack': {
          const channelId = slackBotService.getCurrentChannelId()
          if (!channelId) {
            console.log('[Proactive] No current Slack channel ID')
            return null
          }
          const result = await slackBotService.sendText(channelId, message)
          if (result.success) {
            console.log('[Proactive] Message sent to Slack successfully')
            return platform
          }
          console.error('[Proactive] Failed to send to Slack:', result.error)
          return null
        }

        case 'whatsapp': {
          const chatId = whatsappBotService.getCurrentChatId()
          if (!chatId) {
            console.log('[Proactive] No current WhatsApp chat ID')
            return null
          }
          const result = await whatsappBotService.sendText(chatId, message)
          if (result.success) {
            console.log('[Proactive] Message sent to WhatsApp successfully')
            return platform
          }
          console.error('[Proactive] Failed to send to WhatsApp:', result.error)
          return null
        }

        case 'line': {
          const source = lineBotService.getCurrentSource()
          if (!source.id) {
            console.log('[Proactive] No current Line source ID')
            return null
          }
          const result = await lineBotService.sendText(source.id, message)
          if (result.success) {
            console.log('[Proactive] Message sent to Line successfully')
            return platform
          }
          console.error('[Proactive] Failed to send to Line:', result.error)
          return null
        }

        default:
          console.log(`[Proactive] Unknown platform: ${platform}`)
          return null
      }
    } catch (error) {
      console.error(`[Proactive] Error sending to ${platform}:`, error)
      return null
    }
  }

  clearHistory(): void {
    this.agentLoopMessages = []
    this.contextMessages = []
    this.hasNewContextMessages = false
  }
}

// Export singleton instance
export const proactiveService = new ProactiveService()
