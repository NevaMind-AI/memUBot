import Anthropic from '@anthropic-ai/sdk'
import path from 'path'
import { loadSettings } from '../config/settings.config'
import { appEvents } from '../events'
import { telegramStorage } from '../apps/telegram/storage'
import { discordStorage } from '../apps/discord/storage'
import { slackStorage } from '../apps/slack/storage'
import { feishuStorage } from '../apps/feishu/storage'
import type { ConversationMessage, AgentResponse } from '../types'
import * as fs from 'fs/promises'

// Import from refactored modules
import {
  MAX_CONTEXT_MESSAGES,
  MAX_CONTEXT_TOKENS,
  estimateTokens,
  createClient
} from './agent/utils'
import { getToolsForPlatform } from './agent/tools'
import { executeTool } from './agent/tool-executor'
import { getSystemPromptForPlatform } from './agent/prompt-builder'

// Re-export types from module for backwards compatibility
export type {
  MessagePlatform,
  UnmemorizedMessage,
  EvaluationDecision,
  EvaluationContext,
  EvaluationData,
  LLMStatus,
  LLMStatusInfo
} from './agent/types'

import type {
  MessagePlatform,
  LLMStatus,
  LLMStatusInfo,
  EvaluationContext,
  EvaluationData,
  EvaluationDecision
} from './agent/types'

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
  private recentReplyPlatform: MessagePlatform = 'none' // Track which platform the user most recently sent a message from
  private processingLock: MessagePlatform | null = null // Global lock for processMessage - only one platform at a time

  /**
   * Get current LLM status
   */
  getStatus(): LLMStatusInfo {
    return this.currentStatus
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
   * Check if a message contains tool_use blocks
   */
  private hasToolUse(msg: Anthropic.MessageParam): boolean {
    if (!Array.isArray(msg.content)) return false
    return msg.content.some(block => block.type === 'tool_use')
  }

  /**
   * Check if a message contains tool_result blocks
   */
  private hasToolResult(msg: Anthropic.MessageParam): boolean {
    if (!Array.isArray(msg.content)) return false
    return msg.content.some(block => block.type === 'tool_result')
  }

  /**
   * Sanitize content blocks for storage in conversation history
   * Removes extra fields that some model providers don't accept
   */
  private sanitizeContentBlocks(content: Anthropic.ContentBlock[]): Anthropic.ContentBlockParam[] {
    return content
      .filter((block) => block.type !== 'thinking')
      .map((block) => {
        if (block.type === 'text') {
          // Only keep type and text
          return { type: 'text' as const, text: block.text }
        } else if (block.type === 'tool_use') {
          // Only keep type, id, name, input
          return {
            type: 'tool_use' as const,
            id: block.id,
            name: block.name,
            input: block.input as Record<string, unknown>
          }
        }
        // For other types, return as-is (shouldn't happen normally)
        return block as unknown as Anthropic.ContentBlockParam
      })
  }

  /**
   * Truncate conversation history if it exceeds token limit
   * Removes oldest messages while ensuring tool_use/tool_result pairs stay together
   */
  private truncateContextIfNeeded(): void {
    // Calculate total tokens
    let totalTokens = this.conversationHistory.reduce((sum, msg) => sum + estimateTokens(msg), 0)
    
    if (totalTokens <= MAX_CONTEXT_TOKENS) {
      return
    }
    
    console.log(`[Agent] Context too large (${totalTokens} tokens), truncating...`)
    
    // Find a safe truncation point - we need to remove messages in pairs when they contain tool_use/tool_result
    // Strategy: Find the earliest point where we can safely cut without breaking tool pairs
    let cutIndex = 0
    
    while (cutIndex < this.conversationHistory.length - 2) {
      // Calculate tokens from cutIndex onwards
      let remainingTokens = 0
      for (let i = cutIndex; i < this.conversationHistory.length; i++) {
        remainingTokens += estimateTokens(this.conversationHistory[i])
      }
      
      if (remainingTokens <= MAX_CONTEXT_TOKENS) {
        break
      }
      
      // Check if current message has tool_use - if so, we need to skip the next message too (tool_result)
      const currentMsg = this.conversationHistory[cutIndex]
      if (this.hasToolUse(currentMsg)) {
        // Skip both this message and the next (tool_result)
        cutIndex += 2
      } else if (this.hasToolResult(currentMsg)) {
        // This shouldn't happen if we're iterating correctly, but handle it anyway
        // Skip this message
        cutIndex += 1
      } else {
        // Regular message, can safely remove
        cutIndex += 1
      }
    }
    
    // Ensure we don't cut too much - keep at least the last 2 messages
    if (cutIndex > this.conversationHistory.length - 2) {
      cutIndex = Math.max(0, this.conversationHistory.length - 2)
    }
    
    // Remove messages up to cutIndex
    if (cutIndex > 0) {
      const removed = this.conversationHistory.splice(0, cutIndex)
      const removedTokens = removed.reduce((sum, msg) => sum + estimateTokens(msg), 0)
      totalTokens -= removedTokens
      console.log(`[Agent] Removed ${removed.length} messages (${removedTokens} tokens)`)
    }
    
    // Verify tool_use/tool_result integrity after truncation
    this.verifyAndFixToolPairs()
    
    // If still too large (single message is huge), we need to handle specially
    if (totalTokens > MAX_CONTEXT_TOKENS && this.conversationHistory.length > 0) {
      // Check if it's a multimodal message with large images
      const firstMsg = this.conversationHistory[0]
      if (Array.isArray(firstMsg.content)) {
        // Remove image blocks from the message to reduce size
        const filteredContent = firstMsg.content.filter(block => {
          if (block.type === 'image') {
            console.log('[Agent] Removing large image from context to fit limit')
            return false
          }
          return true
        })
        if (filteredContent.length > 0) {
          firstMsg.content = filteredContent as Anthropic.ContentBlockParam[]
        } else {
          // No content left, add a placeholder
          firstMsg.content = '[Previous image removed due to size limit]'
        }
      }
    }
    
    totalTokens = this.conversationHistory.reduce((sum, msg) => sum + estimateTokens(msg), 0)
    console.log(`[Agent] Context truncated to ${this.conversationHistory.length} messages (~${totalTokens} tokens)`)
  }

  /**
   * Verify and fix tool_use/tool_result pairs in conversation history
   * If a tool_use exists without a corresponding tool_result, remove it
   */
  private verifyAndFixToolPairs(): void {
    // Collect all tool_use IDs
    const toolUseIds = new Set<string>()
    const toolResultIds = new Set<string>()
    
    for (const msg of this.conversationHistory) {
      if (!Array.isArray(msg.content)) continue
      
      for (const block of msg.content) {
        if (block.type === 'tool_use') {
          toolUseIds.add(block.id)
        } else if (block.type === 'tool_result') {
          toolResultIds.add(block.tool_use_id)
        }
      }
    }
    
    // Find orphaned tool_use IDs (no corresponding tool_result)
    const orphanedIds = new Set<string>()
    for (const id of toolUseIds) {
      if (!toolResultIds.has(id)) {
        orphanedIds.add(id)
        console.log(`[Agent] Found orphaned tool_use: ${id}`)
      }
    }
    
    // Find orphaned tool_result IDs (no corresponding tool_use)
    for (const id of toolResultIds) {
      if (!toolUseIds.has(id)) {
        orphanedIds.add(id)
        console.log(`[Agent] Found orphaned tool_result: ${id}`)
      }
    }
    
    if (orphanedIds.size === 0) return
    
    // Remove messages containing orphaned tool blocks
    this.conversationHistory = this.conversationHistory.filter(msg => {
      if (!Array.isArray(msg.content)) return true
      
      // Check if any block in this message is orphaned
      const hasOrphan = msg.content.some(block => {
        if (block.type === 'tool_use' && orphanedIds.has(block.id)) return true
        if (block.type === 'tool_result' && orphanedIds.has(block.tool_use_id)) return true
        return false
      })
      
      if (hasOrphan) {
        console.log(`[Agent] Removing message with orphaned tool block`)
        return false
      }
      return true
    })
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
      } else if (platform === 'feishu') {
        const storedMessages = await feishuStorage.getMessages(MAX_CONTEXT_MESSAGES)
        // For Feishu, also include image attachments in context
        for (const m of storedMessages) {
          const hasImages = m.attachments?.some(a => a.contentType?.startsWith('image/'))
          if (hasImages && !m.isFromBot) {
            // Load images for user messages (limit to recent messages to avoid memory issues)
            const imageAttachments = m.attachments?.filter(a => a.contentType?.startsWith('image/')) || []
            const imageContents: Anthropic.ContentBlockParam[] = []
            const imagePaths: string[] = [] // Track local paths for reference
            const MAX_IMAGE_SIZE_MB = 1 // Images larger than 2MB will be treated as files
            
            for (const att of imageAttachments.slice(0, 3)) { // Max 3 images per message
              if (att.url && !att.url.startsWith('http')) {
                // Local file - check size and convert to base64 if small enough
                try {
                  const imageData = await fs.readFile(att.url)
                  const imageSizeMB = imageData.length / (1024 * 1024)
                  
                  if (imageSizeMB > MAX_IMAGE_SIZE_MB) {
                    // Image too large - just track path, don't convert to base64
                    console.log(`[Agent] Historical image too large (${imageSizeMB.toFixed(2)}MB), skipping base64: ${att.url}`)
                    imagePaths.push(att.url)
                  } else {
                    // Detect media type from magic bytes
                    let mediaType = 'image/png'
                    if (imageData[0] === 0xff && imageData[1] === 0xd8) mediaType = 'image/jpeg'
                    else if (imageData[0] === 0x89 && imageData[1] === 0x50) mediaType = 'image/png'
                    else if (imageData[0] === 0x47 && imageData[1] === 0x49) mediaType = 'image/gif'
                    
                    imageContents.push({
                      type: 'image',
                      source: {
                        type: 'base64',
                        media_type: mediaType as 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp',
                        data: imageData.toString('base64')
                      }
                    })
                    imagePaths.push(att.url)
                  }
                } catch (err) {
                  console.log(`[Agent] Could not load historical image: ${att.url}`)
                }
              }
            }
            
            if (imageContents.length > 0 || imagePaths.length > 0) {
              // Build text with image paths and user's message
              const pathInfo = imagePaths.map((p, i) => `[Image ${i + 1} local path: ${p}]`).join('\n')
              const textParts = [pathInfo]
              if (m.text) {
                textParts.push(m.text)
              }
              
              if (imageContents.length > 0) {
                // Has small images - create multimodal message
                imageContents.push({ type: 'text', text: textParts.join('\n\n') })
                messages.push({
                  text: undefined, // Will be handled specially
                  isFromBot: false,
                  _multimodal: imageContents
                } as { text?: string; isFromBot: boolean; _multimodal?: Anthropic.ContentBlockParam[] })
              } else {
                // All images too large - just add as text with paths
                messages.push({
                  text: textParts.join('\n\n'),
                  isFromBot: false
                })
              }
              continue
            }
          }
          
          messages.push({
            text: m.text,
            isFromBot: m.isFromBot
          })
        }
      }

      // Convert to Anthropic message format
      // We need to group consecutive messages from the same role
      if (messages.length > 0) {
        let lastRole: 'user' | 'assistant' | null = null
        let totalTokens = 0
        
        for (const msg of messages as Array<{ text?: string; isFromBot: boolean; _multimodal?: Anthropic.ContentBlockParam[] }>) {
          // Handle multimodal messages (images)
          if (msg._multimodal && msg._multimodal.length > 0) {
            const role = 'user' as const
            // For multimodal, we can't easily merge, so add as new message
            if (role !== lastRole || this.conversationHistory.length === 0) {
              const newMsg: Anthropic.MessageParam = {
                role,
                content: msg._multimodal
              }
              const msgTokens = estimateTokens(newMsg)
              
              // Check if adding this message would exceed token limit
              if (totalTokens + msgTokens > MAX_CONTEXT_TOKENS) {
                console.log(`[Agent] Stopping context load - would exceed token limit (${totalTokens} + ${msgTokens} > ${MAX_CONTEXT_TOKENS})`)
                break
              }
              
              this.conversationHistory.push(newMsg)
              totalTokens += msgTokens
              lastRole = role
            }
            continue
          }
          
          if (!msg.text) continue
          
          const role: 'user' | 'assistant' = msg.isFromBot ? 'assistant' : 'user'
          
          // Anthropic API requires alternating user/assistant messages
          // If same role as last, append to previous or skip
          if (role === lastRole && this.conversationHistory.length > 0) {
            // Append to last message
            const lastMsg = this.conversationHistory[this.conversationHistory.length - 1]
            if (typeof lastMsg.content === 'string') {
              lastMsg.content = lastMsg.content + '\n\n' + msg.text
              totalTokens += Math.ceil(msg.text.length / 4)
            }
          } else {
            const newMsg: Anthropic.MessageParam = {
              role,
              content: msg.text
            }
            const msgTokens = estimateTokens(newMsg)
            
            // Check if adding this message would exceed token limit
            if (totalTokens + msgTokens > MAX_CONTEXT_TOKENS) {
              console.log(`[Agent] Stopping context load - would exceed token limit (${totalTokens} + ${msgTokens} > ${MAX_CONTEXT_TOKENS})`)
              break
            }
            
            this.conversationHistory.push(newMsg)
            totalTokens += msgTokens
            lastRole = role
          }
        }
        
        console.log(`[Agent] Loaded ${this.conversationHistory.length} context messages (~${totalTokens} tokens)`)
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
      } else {
        // Build message content with images if present
        if (imageUrls.length > 0) {
          // Create multimodal content with images and text
          const contentParts: Anthropic.ContentBlockParam[] = []
          const localImagePaths: string[] = [] // Track local paths for reference
          
          // Add images first
          for (const imageUrl of imageUrls) {
            // Check if it's a local file path or a URL
            if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
              // Remote URL - use url type
              contentParts.push({
                type: 'image',
                source: {
                  type: 'url',
                  url: imageUrl
                }
              } as Anthropic.ImageBlockParam)
            } else {
              // Local file path - read and convert to base64
              try {
                const imageData = await fs.readFile(imageUrl)
                const imageSizeMB = imageData.length / (1024 * 1024)
                const MAX_IMAGE_SIZE_MB = 1 // Images larger than 2MB will be treated as files
                
                if (imageSizeMB > MAX_IMAGE_SIZE_MB) {
                  // Image too large - treat as file instead of base64
                  console.log(`[Agent] Image too large (${imageSizeMB.toFixed(2)}MB > ${MAX_IMAGE_SIZE_MB}MB), treating as file: ${path.basename(imageUrl)}`)
                  localImagePaths.push(imageUrl)
                  // Don't add to contentParts as image - will be added as text path only
                } else {
                  // Convert to base64
                  const base64Data = imageData.toString('base64')
                  
                  // Detect media type from file magic bytes (more reliable than extension)
                  let mediaType = 'image/png' // default
                  if (imageData[0] === 0xff && imageData[1] === 0xd8 && imageData[2] === 0xff) {
                    mediaType = 'image/jpeg'
                  } else if (imageData[0] === 0x89 && imageData[1] === 0x50 && imageData[2] === 0x4e && imageData[3] === 0x47) {
                    mediaType = 'image/png'
                  } else if (imageData[0] === 0x47 && imageData[1] === 0x49 && imageData[2] === 0x46) {
                    mediaType = 'image/gif'
                  } else if (imageData[0] === 0x52 && imageData[1] === 0x49 && imageData[2] === 0x46 && imageData[3] === 0x46) {
                    // RIFF header - could be WebP
                    if (imageData[8] === 0x57 && imageData[9] === 0x45 && imageData[10] === 0x42 && imageData[11] === 0x50) {
                      mediaType = 'image/webp'
                    }
                  }
                  
                  console.log(`[Agent] Detected media type: ${mediaType} for ${path.basename(imageUrl)} (${imageSizeMB.toFixed(2)}MB)`)
                  
                  contentParts.push({
                    type: 'image',
                    source: {
                      type: 'base64',
                      media_type: mediaType as 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp',
                      data: base64Data
                    }
                  } as Anthropic.ImageBlockParam)
                  localImagePaths.push(imageUrl)
                  console.log(`[Agent] Converted local image to base64: ${path.basename(imageUrl)}`)
                }
              } catch (err) {
                console.error(`[Agent] Failed to read local image: ${imageUrl}`, err)
              }
            }
          }
          
          // Build text with local image paths (so Agent knows where to find them)
          const textParts: string[] = []
          if (localImagePaths.length > 0) {
            const pathInfo = localImagePaths.map((p, i) => `[Image ${i + 1} local path: ${p}]`).join('\n')
            textParts.push(pathInfo)
          }
          if (userMessage) {
            textParts.push(userMessage)
          }
          
          // Add text if present
          if (textParts.length > 0) {
            contentParts.push({
              type: 'text',
              text: textParts.join('\n\n')
            })
          }
          
          const multimodalMessage: Anthropic.MessageParam = {
            role: 'user',
            content: contentParts
          }
          this.conversationHistory.push(multimodalMessage)
          console.log(`[Agent] Added multimodal message with ${imageUrls.length} images`)
        } else {
          // Text-only message
          const textMessage: Anthropic.MessageParam = {
            role: 'user',
            content: userMessage
          }
          this.conversationHistory.push(textMessage)
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
    const settings = await loadSettings()
    const systemPrompt = await getSystemPromptForPlatform(this.currentPlatform)
    const tools = getToolsForPlatform(this.currentPlatform, {
      visualModeEnabled: settings.experimentalVisualMode,
      computerUseEnabled: settings.experimentalComputerUse
    })

    console.log(`[Agent] Using tools for platform: ${this.currentPlatform}`)
    console.log(`[Agent] Visual mode: ${settings.experimentalVisualMode ? 'enabled' : 'disabled'}`)
    console.log(`[Agent] Computer use: ${settings.experimentalComputerUse ? 'enabled' : 'disabled'}`)
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

      // Check and truncate context if too large
      this.truncateContextIfNeeded()
      
      // Verify tool_use/tool_result pairs before API call
      // This handles cases where previous session was interrupted mid-tool-execution
      this.verifyAndFixToolPairs()

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

        // Add assistant response to history (sanitize to remove extra fields)
        const assistantMessage: Anthropic.MessageParam = {
          role: 'assistant',
          content: this.sanitizeContentBlocks(response.content)
        }
        this.conversationHistory.push(assistantMessage)

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

    // Add assistant's response (with tool use) to history (sanitize to remove extra fields)
    const assistantToolUseMessage: Anthropic.MessageParam = {
      role: 'assistant',
      content: this.sanitizeContentBlocks(response.content)
    }
    this.conversationHistory.push(assistantToolUseMessage)

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
      const result = await this.executeToolInternal(toolUse.name, toolUse.input)

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
  }

  /**
   * Execute a single tool
   * Delegates to the tool-executor module
   */
  private async executeToolInternal(
    name: string,
    input: unknown
  ): Promise<{ success: boolean; data?: unknown; error?: string }> {
    return await executeTool(name, input, this.currentPlatform)
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
        system: `You are a STRICT evaluation assistant. Your job is to decide whether an event warrants notifying the user based on their EXACT expectations.

You MUST respond with a valid JSON object in this exact format:
{
  "shouldNotify": true or false,
  "message": "The notification message to send to user (only if shouldNotify is true)",
  "reason": "Brief explanation of your decision"
}

STRICT Guidelines:
- Be VERY conservative: only notify when the event EXACTLY matches user's expectations
- For TIME-BASED requests (reminders, alarms):
  - ONLY notify when current time >= target time (not before!)
  - "Remind me at 4:30pm" means notify at 4:30pm or after, NEVER before
  - Being "close to" the time (e.g., 3 minutes early) is NOT a match - REJECT it
- For THRESHOLD-BASED requests (price alerts, monitoring):
  - The threshold must be clearly met or exceeded
  - "Near" the threshold is NOT enough
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

    return `Strictly evaluate whether the following event should trigger a notification.

== USER'S ORIGINAL REQUEST ==
${context.userRequest}

== USER'S EXPECTATION ==
${context.expectation}

== CURRENT EVENT ==
Time: ${data.timestamp}
Summary: ${data.summary}
${data.details ? `Details: ${data.details}` : ''}${metadataStr}

IMPORTANT: Only return shouldNotify=true if the conditions are EXACTLY met:
- For time-based requests: current time must be AT or AFTER the target time
- For threshold-based requests: the threshold must be clearly met or exceeded

Should this event trigger a notification? Answer strictly based on whether conditions are EXACTLY met.`
  }
}

// Export singleton instance
export const agentService = new AgentService()
