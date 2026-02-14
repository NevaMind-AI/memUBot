import Anthropic from '@anthropic-ai/sdk'
import { loadSettings } from '../config/settings.config'
import { agentService, type MessagePlatform, type UnmemorizedMessage } from './agent.service'
import { proactiveStorage, type ChatPlatform, type ChatPlatformTimestamps } from './proactive.storage'
import { infraService, type IncomingMessageEvent } from './infra.service'
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
import { telegramStorage } from '../apps/telegram/storage'
import { discordStorage } from '../apps/discord/storage'
import { slackStorage } from '../apps/slack/storage'
import { whatsappStorage } from '../apps/whatsapp/storage'
import { lineStorage } from '../apps/line/storage'
import type { AgentResponse } from '../types'

/**
 * Default polling interval in milliseconds
 */
const DEFAULT_INTERVAL_MS = 10000

/**
 * Polling interval for checking memorization status
 */
const MEMORIZE_STATUS_POLL_INTERVAL_MS = 10000

/**
 * Maximum time to wait for memorization to complete (5 minutes)
 */
const MEMORIZE_MAX_WAIT_MS = 5 * 60 * 1000

/**
 * Polling interval for checking user input
 */
const USER_INPUT_POLL_INTERVAL_MS = 1000

/**
 * Maximum time to wait for user input (10 minutes)
 */
const USER_INPUT_MAX_WAIT_MS = 10 * 60 * 1000

/**
 * Threshold for number of messages to trigger chat memorization
 */
const CHAT_MEMORIZE_MESSAGE_THRESHOLD = 20

/**
 * Threshold for time since last message to trigger chat memorization (60 minutes)
 */
const CHAT_MEMORIZE_TIME_THRESHOLD_MS = 60 * 60 * 1000

/**
 * Memorization task status
 */
type MemorizeStatus = 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'FAILURE'

/**
 * Response from memorization status endpoint
 */
interface MemorizeStatusResponse {
  task_id: string
  status: MemorizeStatus
  detail_info: string
}

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
const PROACTIVE_SYSTEM_PROMPT = `You are a helpful AI assistant working in an autonomous mode. You help the user accomplish tasks and manage their todos.

You have access to:
1. **Bash/Terminal** - Execute shell commands for file operations, git, npm, system info, etc.
2. **Text editor** - View and edit files with precision
3. **Memory retrieval** - Access past conversations and context
4. **Todo management** - View and manage your task list
5. **User confirmation** - Wait for user input when you need feedback or approval

Guidelines:
- When given todos, help the user make progress on them
- Use memory retrieval to provide personalized, context-aware responses
- Be proactive in suggesting next steps
- Keep responses concise and actionable
- If you complete a todo item, mention it explicitly
- Use wait_user_confirm when you need user approval before destructive operations or important decisions
- If you have retried a todo multiple times but still do not make progress, mention it as unable to accomplish, and move to other todos`

const MEMORIZE_OVERRIDE_CONFIG = {
  memory_types: ["record"],
  memory_type_prompts: {
    record: {
      objective: {
        ordinal: 10,
        prompt: "# Task Objective\nYou will be given a conversation between a user and an coding agent. Your goal is to extract detailed records for what are planed to do, and what have been done."
      },
      workflow: {
        ordinal: 20,
        prompt: "# Workflow\nRead through the conversation and extract records. You should expecially focus on:\n- What the user ask the agent to do\n- What plan does the agent suggest\n- What the agent has done\n- What the agent has failed to do or considers unsolvable"
      },
      rules: {
        ordinal: -1,
        prompt: null
      },
      examples: {
        ordinal: 60,
        prompt: "# Example\n## Output\n<item>\n    <memory>\n        <content>The user ask the agent to generate a code example for fastapi</content>\n        <categories>\n            <category>todo</category>\n        </categories>\n    </memory>\n    <memory>\n        <content>The agent suggest to use the code example from the document</content>\n        <categories>\n            <category>todo</category>\n        </categories>\n    </memory>\n    <memory>\n        <content>The agent ask the user to specify the response type</content>\n        <categories>\n            <category>todo</category>\n        </categories>\n    </memory>\n    <memory>\n        <content>The agent is unable to get the image that the user want, and decide to move to other tasks</content>\n        <categories>\n            <category>todo</category>\n        </categories>\n    </memory>\n</item>"
      }
    }
  },
  memory_categories: [
    {
      name: "todo",
      description: "This file traces the latest status of the task. All records should be included in this file.",
      target_length: null,
      summary_prompt: {
        objective: {
          ordinal: 10,
          prompt: "# Task Objective\nYou are a specialist in task management. You should update the markdown file to reflect the latest status of the task."
        },
        workflow: {
          ordinal: 20,
          prompt: "# Workflow\nRead through the existing markdown file and the new records. Then update the markdown file to reflect:\n- What existing tasks are completed\n- What new tasks are added\n- What tasks are still in progress\n- What tasks are failed to be accomplished"
        },
        rules: {
          ordinal: 30,
          prompt: "# Rules\nFor each action-like record, explictly mark it as [Done], [Todo], or [Failed]."
        },
        examples: {
          ordinal: 50,
          prompt: "# Example\n## Output\n```markdown\n# Task\n## Task Objective\nThe user ask the agent to generate a code example for fastapi\n## Breakdown\n- [Done] The agent suggest to use the code example from the document\n- [Todo] The agent ask the user to specify the response type\n - [Failed] The agent is unable to get the image that the user want```"
        }
      }
    }
  ]
}

/**
 * Proactive Service
 * Background task that:
 * 1. Periodically memorizes conversation history
 * 2. Checks for todos and processes them when idle
 */
/**
 * Chat message from platforms (unified format for memorization)
 */
interface ChatMessageForMemorize {
  platform: ChatPlatform
  role: 'user' | 'assistant'
  content: string
  date: number // Unix timestamp in seconds
}

/**
 * Chat memorization task info
 */
interface ChatMemorizationTask {
  timestampsByPlatform: ChatPlatformTimestamps
  messageCount: number
}

class ProactiveService {
  private isRunning = false
  private tickIntervalMs = DEFAULT_INTERVAL_MS
  private conversationHistory: Anthropic.MessageParam[] = []
  private unmemorizedMessages: Anthropic.MessageParam[] = []
  private isWaitingUserInput = false // Flag to indicate if waiting for user input
  private waitingUserInputFromPlatform: MessagePlatform | null = null
  private userInput: string | null = null
  
  // Chat memorization state
  private isMemorizingChat = false // Flag to track if chat memorization is running
  private chatUnmemorizedMessages: ChatMessageForMemorize[] = [] // Messages waiting to be memorized
  private chatUnmemorizedTimestamps: ChatPlatformTimestamps = {} // Timestamps of the first message in the unmemorized messages
  private chatMemorizationTasks: Map<string, ChatMemorizationTask> = new Map() // Map of task_id -> task info

  // InfraService subscription
  private unsubscribeFromInfra: (() => void) | null = null

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
      proactiveAgentId: settings.memuProactiveAgentId
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
    const settings = await loadSettings()
    if (!settings.memuApiKey || settings.memuApiKey.trim() === '') {
      console.log('[Proactive] memuApiKey not configured, service will not start')
      console.log('[Proactive] Please configure memuApiKey in settings and call start() again')
      return false
    }

    console.log('[Proactive] First run - collecting and memorizing chat messages from all platforms')
    await this.collectAndMemorizeChatMessages()

    console.log(`[Proactive] Starting service with ${intervalMs}ms interval`)
    this.isRunning = true
    this.tickIntervalMs = intervalMs

    // Subscribe to infraService for real-time message notifications
    this.unsubscribeFromInfra = infraService.subscribe('message:incoming', (event) => {
      this.handleIncomingMessage(event)
    })
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
    if (this.unsubscribeFromInfra) {
      this.unsubscribeFromInfra()
      this.unsubscribeFromInfra = null
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

    // Push to unmemorizedMessages for proactive memorization
    this.unmemorizedMessages.push(event.message)

    // Also push to chatUnmemorizedMessages for chat memorization (if not 'none' platform)
    if (event.platform !== 'none') {
      const content = typeof event.message.content === 'string'
        ? event.message.content
        : JSON.stringify(event.message.content)

      this.chatUnmemorizedMessages.push({
        platform: event.platform as ChatPlatform,
        role: event.message.role,
        content,
        date: event.timestamp
      })

      // Update timestamps - only set if not already set for this platform
      if (!this.chatUnmemorizedTimestamps[event.platform as ChatPlatform]) {
        this.chatUnmemorizedTimestamps[event.platform as ChatPlatform] = event.timestamp
      }

      console.log(`[Proactive] Added message from ${event.platform} to chat memorization queue (total: ${this.chatUnmemorizedMessages.length})`)
    }
  }

  /**
   * Single tick of the polling loop
   * With setTimeout self-scheduling, ticks are guaranteed to run sequentially
   * (next tick only starts after previous one completes + interval delay)
   */
  private async tick(): Promise<void> {
    try {
      // Step 1: Check if AgentService is idle
      const agentStatus = agentService.getStatus()
      if (agentStatus.status !== 'idle') {
        console.log(`[Proactive] Agent is ${agentStatus.status}, skipping this tick`)
        return
      }

      // Step 2: Check if we should trigger chat memorization
      if (this.chatUnmemorizedMessages.length > 0 && !this.isMemorizingChat) {
        const lastMessage = this.chatUnmemorizedMessages[this.chatUnmemorizedMessages.length - 1]
        const timeSinceLastMessage = Date.now() - (lastMessage.date * 1000)
        
        const shouldMemorize = 
          this.chatUnmemorizedMessages.length >= CHAT_MEMORIZE_MESSAGE_THRESHOLD ||
          timeSinceLastMessage >= CHAT_MEMORIZE_TIME_THRESHOLD_MS
        
        if (shouldMemorize) {
          console.log(`[Proactive] Triggering chat memorization: ${this.chatUnmemorizedMessages.length} messages, ${Math.floor(timeSinceLastMessage / 1000)}s since last message`)
          this.triggerChatMemorizationInBackground(
            { ...this.chatUnmemorizedTimestamps },
            this.chatUnmemorizedMessages.length
          )
          // Reset timestamps for next batch
          // this.chatUnmemorizedTimestamps = {}
        }
      }
      
      if (this.unmemorizedMessages.length > 0) {
        console.log(`[Proactive] Found ${this.unmemorizedMessages.length} unmemorized messages, triggering memorize`)
        
        const taskId = await this.triggerMemorize(this.unmemorizedMessages)
        
        if (taskId) {
          console.log(`[Proactive] Memorize triggered with task_id: ${taskId}`)
          const success = await this.waitMemorizeComplete(taskId)
          
          if (success) {
            // Clear own unmemorizedMessages on success
            this.unmemorizedMessages = []
            console.log('[Proactive] Cleared own unmemorizedMessages after successful memorization')
          }
        } else {
          console.log('[Proactive] Memorize failed, continuing to next iteration')
        }
        
        // Go to next iteration after memorization attempt
        return
      }

      // Step 3: No unmemorized messages, check for todos
      console.log('[Proactive] No unmemorized messages, checking todos')
      const todos = await this.getTodos()
      
      if (!todos || !todos.toLowerCase().includes('[todo]')) {
        console.log('[Proactive] No todos found, nothing to do')
        return
      }

      console.log('[Proactive] Found todos, running agent loop')
      console.log('[Proactive] Todos:', todos.substring(0, 100) + (todos.length > 100 ? '...' : ''))
      
      // Add todos as user message and run agent loop
      const userMessage: Anthropic.MessageParam = {
        role: 'user',
        content: `Please continue with the user's todos:\n\n${todos}`
      }
      this.conversationHistory.push(userMessage)
      this.unmemorizedMessages.push(userMessage)
      await proactiveStorage.storeMessage(userMessage)
      
      await this.runAgentLoop()
      
    } catch (error) {
      // Log error but don't stop the loop
      console.error('[Proactive] Error in tick:', error)
    }
    // No need for finally block - setTimeout scheduling handles sequential execution
  }

  /**
   * Get todos directly (for checking if proactive should continue)
   */
  private async getTodos(): Promise<string> {
    const result = await this.executeMemuTodos()
    if (result.success && result.data) {
      return (result.data as { todos: string }).todos || ''
    }
    return ''
  }

  /**
   * Trigger memorization of messages
   * @returns task_id on success, null on failure
   */
  private async triggerMemorize(messages: Anthropic.MessageParam[]): Promise<string | null> {
    try {
      const memuConfig = await this.getMemuConfig()
      
      // Convert Anthropic.MessageParam to simple format for API
      const formattedMessages = messages.map(m => ({
        role: m.role,
        content: typeof m.content === 'string' 
          ? m.content 
          : Array.isArray(m.content)
            ? m.content.map(block => {
                if ('text' in block) return block.text
                if ('type' in block && block.type === 'tool_result') {
                  return `[Tool Result: ${JSON.stringify(block)}]`
                }
                return JSON.stringify(block)
              }).join('\n')
            : JSON.stringify(m.content)
      }))
      
      const response = await fetch(`${memuConfig.baseUrl}/api/v3/memory/memorize`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${memuConfig.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          user_id: memuConfig.proactiveUserId,
          agent_id: memuConfig.proactiveAgentId,
          conversation: formattedMessages,
          override_config: MEMORIZE_OVERRIDE_CONFIG
        })
      })
      
      if (!response.ok) {
        console.error('[Proactive] Memorization failed with status:', response.status)
        return null
      }
      
      const result = await response.json() as { task_id?: string }
      return result.task_id || null
    } catch (error) {
      console.error('[Proactive] Memorization failed:', error)
      return null
    }
  }

  /**
   * Wait for memorization to complete by polling the status endpoint
   * Polls every 5 seconds until status is SUCCESS or FAILURE
   * @returns true if SUCCESS, false if FAILURE or timeout
   */
  private async waitMemorizeComplete(taskId: string): Promise<boolean> {
    console.log(`[Proactive] Waiting for memorize task ${taskId} to complete...`)
    
    const memuConfig = await this.getMemuConfig()
    const startTime = Date.now()
    
    while (Date.now() - startTime < MEMORIZE_MAX_WAIT_MS) {
      try {
        const response = await fetch(`${memuConfig.baseUrl}/api/v3/memory/memorize/status/${taskId}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${memuConfig.apiKey}`,
            'Content-Type': 'application/json'
          }
        })
        
        if (!response.ok) {
          console.error(`[Proactive] Failed to get memorize status: ${response.status}`)
          // Wait and retry
          await new Promise(resolve => setTimeout(resolve, MEMORIZE_STATUS_POLL_INTERVAL_MS))
          continue
        }
        
        const result = await response.json() as MemorizeStatusResponse
        console.log(`[Proactive] Memorize task ${taskId} status: ${result.status}`)
        
        if (result.status === 'SUCCESS') {
          console.log(`[Proactive] Memorize task ${taskId} completed successfully`)
          return true
        }
        
        if (result.status === 'FAILURE') {
          console.error(`[Proactive] Memorize task ${taskId} failed: ${result.detail_info}`)
          return false
        }
        
        // Status is PENDING or PROCESSING, wait and poll again
        await new Promise(resolve => setTimeout(resolve, MEMORIZE_STATUS_POLL_INTERVAL_MS))
        
      } catch (error) {
        console.error(`[Proactive] Error polling memorize status:`, error)
        // Wait and retry
        await new Promise(resolve => setTimeout(resolve, MEMORIZE_STATUS_POLL_INTERVAL_MS))
      }
    }
    
    console.error(`[Proactive] Memorize task ${taskId} timed out after ${MEMORIZE_MAX_WAIT_MS / 1000}s`)
    return false
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
        model = settings.claudeModel || 'claude-opus-4-5'
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
   * Run the agent loop for processing todos
   * Tracks messages in unmemorizedMessages for later memorization
   */
  private async runAgentLoop(): Promise<AgentResponse> {
    const { client, model, maxTokens } = await this.createClient()
    const tools = this.getTools()

    console.log('[Proactive] Starting agent loop')
    console.log(`[Proactive] Available tools: ${tools.map(t => t.name).join(', ')}`)

    let iterations = 0
    const maxIterations = 50 // Prevent infinite loops

    while (iterations < maxIterations) {
      iterations++
      console.log(`[Proactive] Loop iteration ${iterations}, model: ${model}`)

      // Call Claude API
      const response = await client.messages.create({
        model,
        max_tokens: maxTokens,
        system: PROACTIVE_SYSTEM_PROMPT,
        tools,
        messages: this.conversationHistory
      })

      console.log('[Proactive] Response received, stop_reason:', response.stop_reason)

      // Check if we need to use tools
      if (response.stop_reason === 'tool_use') {
        // Process tool calls
        await this.processToolUse(response)
      } else {
        // Extract final text response
        const textContent = response.content.find((block) => block.type === 'text')
        const message = textContent && textContent.type === 'text' ? textContent.text : ''

        // Add assistant response to history and track for memorization
        const assistantMessage: Anthropic.MessageParam = {
          role: 'assistant',
          content: response.content
        }
        this.conversationHistory.push(assistantMessage)
        this.unmemorizedMessages.push(assistantMessage)

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
   * Tracks messages in unmemorizedMessages for later memorization
   */
  private async processToolUse(response: Anthropic.Message): Promise<void> {
    // Add assistant's response (with tool use) to history and track for memorization
    const assistantMessage: Anthropic.MessageParam = {
      role: 'assistant',
      content: response.content
    }
    this.conversationHistory.push(assistantMessage)
    this.unmemorizedMessages.push(assistantMessage)
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

    // Add tool results to history and track for memorization
    const toolResultsMessage: Anthropic.MessageParam = {
      role: 'user',
      content: toolResults
    }
    this.conversationHistory.push(toolResultsMessage)
    this.unmemorizedMessages.push(toolResultsMessage)
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

  /**
   * Collect chat messages from all platforms and trigger memorization
   * This runs on the first tick and does not block subsequent ticks
   */
  private async collectAndMemorizeChatMessages(): Promise<void> {
    // Don't start if already memorizing
    if (this.isMemorizingChat) {
      console.log('[Proactive] Chat memorization already in progress, skipping')
      return
    }

    try {
      // Get current timestamps
      const timestamps = await proactiveStorage.getChatTimestamps()
      console.log('[Proactive] Current chat timestamps:', timestamps)

      // Collect messages from all platforms
      const allMessages: ChatMessageForMemorize[] = []
      const newTimestamps: ChatPlatformTimestamps = {}

      // Telegram
      const telegramMessages = await this.collectPlatformMessages(
        'telegram',
        timestamps.telegram,
        async () => {
          const msgs = await telegramStorage.getMessages(200)
          return msgs.map(m => ({
            role: (m.isFromBot ? 'assistant' : 'user') as 'user' | 'assistant',
            content: m.text || '',
            date: m.date
          }))
        }
      )
      if (telegramMessages.messages.length > 0) {
        allMessages.push(...telegramMessages.messages)
        if (telegramMessages.lastTimestamp) {
          newTimestamps.telegram = telegramMessages.lastTimestamp
        }
      }

      // Discord
      const discordMessages = await this.collectPlatformMessages(
        'discord',
        timestamps.discord,
        async () => {
          const msgs = await discordStorage.getMessages(200)
          return msgs.map(m => ({
            role: (m.isFromBot ? 'assistant' : 'user') as 'user' | 'assistant',
            content: m.text || '',
            date: m.date
          }))
        }
      )
      if (discordMessages.messages.length > 0) {
        allMessages.push(...discordMessages.messages)
        if (discordMessages.lastTimestamp) {
          newTimestamps.discord = discordMessages.lastTimestamp
        }
      }

      // Slack
      const slackMessages = await this.collectPlatformMessages(
        'slack',
        timestamps.slack,
        async () => {
          const msgs = await slackStorage.getMessages(200)
          return msgs.map(m => ({
            role: (m.isFromBot ? 'assistant' : 'user') as 'user' | 'assistant',
            content: m.text || '',
            date: m.date
          }))
        }
      )
      if (slackMessages.messages.length > 0) {
        allMessages.push(...slackMessages.messages)
        if (slackMessages.lastTimestamp) {
          newTimestamps.slack = slackMessages.lastTimestamp
        }
      }

      // WhatsApp
      const whatsappMessages = await this.collectPlatformMessages(
        'whatsapp',
        timestamps.whatsapp,
        async () => {
          const msgs = await whatsappStorage.getMessages(200)
          return msgs.map(m => ({
            role: (m.isFromBot ? 'assistant' : 'user') as 'user' | 'assistant',
            content: m.text || '',
            date: m.date
          }))
        }
      )
      if (whatsappMessages.messages.length > 0) {
        allMessages.push(...whatsappMessages.messages)
        if (whatsappMessages.lastTimestamp) {
          newTimestamps.whatsapp = whatsappMessages.lastTimestamp
        }
      }

      // Line
      const lineMessages = await this.collectPlatformMessages(
        'line',
        timestamps.line,
        async () => {
          const msgs = await lineStorage.getMessages(200)
          return msgs.map(m => ({
            role: (m.isFromBot ? 'assistant' : 'user') as 'user' | 'assistant',
            content: m.text || '',
            date: m.date
          }))
        }
      )
      if (lineMessages.messages.length > 0) {
        allMessages.push(...lineMessages.messages)
        if (lineMessages.lastTimestamp) {
          newTimestamps.line = lineMessages.lastTimestamp
        }
      }

      // If no new messages, skip memorization
      if (allMessages.length === 0) {
        console.log('[Proactive] No new chat messages to memorize')
        return
      }

      // Sort all messages by date
      allMessages.sort((a, b) => a.date - b.date)
      console.log(`[Proactive] Collected ${allMessages.length} new chat messages from all platforms`)

      // Append to unmemorized messages (in case there are already pending messages)
      this.chatUnmemorizedMessages.push(...allMessages)

      // Trigger memorization in background (non-blocking), passing timestamps and message count
      this.triggerChatMemorizationInBackground(newTimestamps, allMessages.length)

    } catch (error) {
      console.error('[Proactive] Error collecting chat messages:', error)
    }
  }

  /**
   * Collect messages from a single platform, filtering by timestamp
   */
  private async collectPlatformMessages(
    platform: ChatPlatform,
    lastTimestamp: number | undefined,
    getMessages: () => Promise<{ role: 'user' | 'assistant'; content: string; date: number }[]>
  ): Promise<{ messages: ChatMessageForMemorize[]; lastTimestamp: number | undefined }> {
    try {
      const rawMessages = await getMessages()
      
      // Filter messages newer than lastTimestamp
      const filtered = lastTimestamp 
        ? rawMessages.filter(m => m.date > lastTimestamp)
        : rawMessages

      if (filtered.length === 0) {
        return { messages: [], lastTimestamp: undefined }
      }

      // Convert to ChatMessageForMemorize format
      const messages: ChatMessageForMemorize[] = filtered.map(m => ({
        platform,
        role: m.role,
        content: m.content,
        date: m.date
      }))

      // Get the latest timestamp
      const lastMessageTimestamp = Math.max(...filtered.map(m => m.date))

      console.log(`[Proactive] Collected ${messages.length} new messages from ${platform}`)
      return { messages, lastTimestamp: lastMessageTimestamp }

    } catch (error) {
      console.error(`[Proactive] Error collecting messages from ${platform}:`, error)
      return { messages: [], lastTimestamp: undefined }
    }
  }

  /**
   * Trigger chat memorization in background (non-blocking)
   * @param timestamps The timestamps to update after successful memorization
   * @param messageCount The number of messages being memorized
   */
  private triggerChatMemorizationInBackground(timestamps: ChatPlatformTimestamps, messageCount: number): void {
    if (this.isMemorizingChat) {
      console.log('[Proactive] Chat memorization already running')
      return
    }

    if (this.chatUnmemorizedMessages.length === 0) {
      console.log('[Proactive] No chat messages to memorize')
      return
    }

    // Start background memorization
    this.isMemorizingChat = true
    console.log(`[Proactive] Starting background chat memorization for ${messageCount} messages`)

    // Run in background (don't await)
    this.runChatMemorization(timestamps, messageCount).catch(error => {
      console.error('[Proactive] Background chat memorization failed:', error)
      this.isMemorizingChat = false
    })
  }

  /**
   * Run chat memorization process
   * @param timestamps The timestamps to update after successful memorization
   * @param messageCount The number of messages being memorized
   */
  private async runChatMemorization(timestamps: ChatPlatformTimestamps, messageCount: number): Promise<void> {
    try {
      const memuConfig = await this.getMemuConfig()

      // Get only the messages for this batch (first messageCount messages)
      const messagesToMemorize = this.chatUnmemorizedMessages.slice(0, messageCount)

      // Format messages for API
      const formattedMessages = messagesToMemorize.map(m => ({
        role: m.role,
        content: `[${m.platform}] ${m.content}`
      }))

      console.log(`[Proactive] Sending ${formattedMessages.length} chat messages to memorize`)

      // Trigger memorization
      const response = await fetch(`${memuConfig.baseUrl}/api/v3/memory/memorize`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${memuConfig.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          user_id: memuConfig.userId,
          agent_id: memuConfig.agentId,
          conversation: formattedMessages
        })
      })

      if (!response.ok) {
        console.error('[Proactive] Chat memorization failed with status:', response.status)
        this.isMemorizingChat = false
        return
      }

      const result = await response.json() as { task_id?: string }
      const taskId = result.task_id

      if (!taskId) {
        console.error('[Proactive] No task_id returned from chat memorization')
        this.isMemorizingChat = false
        return
      }

      console.log(`[Proactive] Chat memorization triggered with task_id: ${taskId}`)

      // Store task info with task_id for later update on success
      this.chatMemorizationTasks.set(taskId, {
        timestampsByPlatform: timestamps,
        messageCount: messageCount
      })

      // Monitor memorization status in background
      await this.monitorChatMemorization(taskId)

    } catch (error) {
      console.error('[Proactive] Chat memorization error:', error)
      this.isMemorizingChat = false
    }
  }

  /**
   * Monitor chat memorization status and update timestamps on success
   */
  private async monitorChatMemorization(taskId: string): Promise<void> {
    const memuConfig = await this.getMemuConfig()
    const startTime = Date.now()

    while (Date.now() - startTime < MEMORIZE_MAX_WAIT_MS) {
      try {
        const response = await fetch(`${memuConfig.baseUrl}/api/v3/memory/memorize/status/${taskId}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${memuConfig.apiKey}`,
            'Content-Type': 'application/json'
          }
        })

        if (!response.ok) {
          console.error(`[Proactive] Failed to get chat memorize status: ${response.status}`)
          await new Promise(resolve => setTimeout(resolve, MEMORIZE_STATUS_POLL_INTERVAL_MS))
          continue
        }

        const result = await response.json() as MemorizeStatusResponse
        console.log(`[Proactive] Chat memorize task ${taskId} status: ${result.status}`)

        if (result.status === 'SUCCESS') {
          console.log(`[Proactive] Chat memorization completed successfully`)
          
          // Get task info and update storage
          const taskInfo = this.chatMemorizationTasks.get(taskId)
          if (taskInfo) {
            // Update timestamps
            await proactiveStorage.updateChatTimestamps(taskInfo.timestampsByPlatform)
            console.log('[Proactive] Updated chat timestamps:', taskInfo.timestampsByPlatform)
            
            // Remove the first messageCount messages that were memorized
            this.chatUnmemorizedMessages.splice(0, taskInfo.messageCount)
            console.log(`[Proactive] Removed ${taskInfo.messageCount} memorized messages, ${this.chatUnmemorizedMessages.length} remaining`)
            
            // Remove task from map
            // this.chatMemorizationTasks.delete(taskId)
          }
          
          this.isMemorizingChat = false
          return
        }

        if (result.status === 'FAILURE') {
          console.error(`[Proactive] Chat memorization failed: ${result.detail_info}`)
          // Remove task from map on failure
          // this.chatMemorizationTasks.delete(taskId)
          this.isMemorizingChat = false
          return
        }

        // Status is PENDING or PROCESSING, wait and poll again
        await new Promise(resolve => setTimeout(resolve, MEMORIZE_STATUS_POLL_INTERVAL_MS))

      } catch (error) {
        console.error(`[Proactive] Error polling chat memorize status:`, error)
        await new Promise(resolve => setTimeout(resolve, MEMORIZE_STATUS_POLL_INTERVAL_MS))
      }
    }

    console.error(`[Proactive] Chat memorization task ${taskId} timed out`)
    // Remove task from map on timeout
    // this.chatMemorizationTasks.delete(taskId)
    this.isMemorizingChat = false
  }

  /**
   * Clear conversation history and unmemorized messages
   */
  clearHistory(): void {
    this.conversationHistory = []
    this.unmemorizedMessages = []
  }
}

// Export singleton instance
export const proactiveService = new ProactiveService()
