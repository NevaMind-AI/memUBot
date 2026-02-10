/**
 * Context compactor - offloads large tool results to files
 *
 * When the conversation history accumulates large tool_result payloads
 * (e.g. DOM snapshots from Playwright, large file contents, screenshots),
 * this module writes them to temporary files and replaces the in-context
 * content with a file path reference. The LLM can use file_read to
 * access the full content on demand.
 *
 * This is the client-side equivalent of Claude's server-side context editing
 * (`clear_tool_uses_20250919`), used for non-Claude providers that don't
 * support that beta feature.
 *
 * Inspired by Cursor's approach: "Long tool call outputs are converted
 * into files rather than truncated, allowing agents to efficiently read
 * data through tail commands and selectively retrieve more information
 * when needed."
 */

import Anthropic from '@anthropic-ai/sdk'
import * as fs from 'fs/promises'
import * as path from 'path'
import { app } from 'electron'
import {
  TOOL_RESULT_FILE_THRESHOLD,
  KEEP_RECENT_TOOL_PAIRS,
  CONTEXT_OFFLOAD_DIR
} from './constants'

/**
 * Get the directory for storing offloaded content files.
 * Creates it if it doesn't exist.
 */
async function getOffloadDir(): Promise<string> {
  const dir = path.join(app.getPath('userData'), CONTEXT_OFFLOAD_DIR)
  await fs.mkdir(dir, { recursive: true })
  return dir
}

/**
 * Write text content to a temporary file and return the path.
 */
async function offloadTextToFile(
  content: string,
  toolName: string,
  toolUseId: string
): Promise<string> {
  const dir = await getOffloadDir()
  // Use a descriptive filename: {timestamp}_{toolName}_{shortId}.txt
  const shortId = toolUseId.slice(-8)
  const timestamp = Date.now()
  const safeName = toolName.replace(/[^a-zA-Z0-9_-]/g, '_')
  const filename = `${timestamp}_${safeName}_${shortId}.txt`
  const filePath = path.join(dir, filename)
  await fs.writeFile(filePath, content, 'utf-8')
  return filePath
}

/**
 * Write base64 image data to a file and return the path.
 */
async function offloadImageToFile(
  base64Data: string,
  mediaType: string,
  toolName: string,
  toolUseId: string
): Promise<string> {
  const dir = await getOffloadDir()
  const shortId = toolUseId.slice(-8)
  const timestamp = Date.now()
  const safeName = toolName.replace(/[^a-zA-Z0-9_-]/g, '_')

  // Determine file extension from media type
  const extMap: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/gif': 'gif',
    'image/webp': 'webp'
  }
  const ext = extMap[mediaType] || 'png'

  const filename = `${timestamp}_${safeName}_${shortId}.${ext}`
  const filePath = path.join(dir, filename)
  await fs.writeFile(filePath, Buffer.from(base64Data, 'base64'))
  return filePath
}

/**
 * Find the tool name for a given tool_use_id by searching preceding assistant messages.
 */
function findToolName(
  messages: Anthropic.MessageParam[],
  toolUseId: string
): string {
  for (const msg of messages) {
    if (msg.role !== 'assistant' || !Array.isArray(msg.content)) continue
    for (const block of msg.content) {
      if (block.type === 'tool_use' && block.id === toolUseId) {
        return block.name
      }
    }
  }
  return 'unknown_tool'
}

/**
 * Build a file reference message for the LLM.
 * The LLM knows it can use file_read to access the content.
 */
function buildFileReference(filePath: string, originalSize: number, contentType: 'text' | 'image'): string {
  if (contentType === 'image') {
    return `[Image offloaded to file: ${filePath}]\n[Use the file_read tool to view this image if needed]`
  }
  return `[Content offloaded to file (${originalSize} chars): ${filePath}]\n[Use the file_read tool to access the full content if needed]`
}

/**
 * Compact old tool_result content by offloading large data to files.
 *
 * Strategy:
 * 1. Find all tool_result messages (from newest to oldest)
 * 2. Keep the most recent KEEP_RECENT_TOOL_PAIRS groups intact
 * 3. For older tool_results:
 *    - Large text content → write to .txt file, replace with path reference
 *    - Base64 images → write to image file, replace with path reference
 *    - Already-small content → keep as-is
 *
 * @param messages The conversation history (mutated in-place)
 * @returns Number of tool results compacted
 */
export async function compactToolResults(
  messages: Anthropic.MessageParam[]
): Promise<number> {
  // Find all tool_result message indices (from newest to oldest)
  const toolResultIndices: number[] = []
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i]
    if (msg.role === 'user' && Array.isArray(msg.content)) {
      const hasToolResult = msg.content.some(
        (block) => typeof block === 'object' && 'type' in block && block.type === 'tool_result'
      )
      if (hasToolResult) {
        toolResultIndices.push(i)
      }
    }
  }

  // Skip the most recent N tool_result messages
  const indicesToCompact = toolResultIndices.slice(KEEP_RECENT_TOOL_PAIRS)

  let compactedCount = 0

  for (const msgIndex of indicesToCompact) {
    const msg = messages[msgIndex]
    if (!Array.isArray(msg.content)) continue

    const newContent = [...msg.content]
    let modified = false

    for (let blockIdx = 0; blockIdx < newContent.length; blockIdx++) {
      const block = newContent[blockIdx]
      if (typeof block !== 'object' || !('type' in block) || block.type !== 'tool_result') {
        continue
      }

      const toolResult = block as Anthropic.ToolResultBlockParam
      const toolUseId = toolResult.tool_use_id
      const toolName = findToolName(messages, toolUseId)

      // --- Handle string content ---
      if (typeof toolResult.content === 'string') {
        if (toolResult.content.length > TOOL_RESULT_FILE_THRESHOLD) {
          try {
            const filePath = await offloadTextToFile(toolResult.content, toolName, toolUseId)
            const reference = buildFileReference(filePath, toolResult.content.length, 'text')
            newContent[blockIdx] = {
              ...toolResult,
              content: reference
            } as typeof block
            modified = true
            compactedCount++
            console.log(`[Context] Offloaded tool_result to file: ${filePath} (${toolResult.content.length} chars, tool: ${toolName})`)
          } catch (err) {
            console.error(`[Context] Failed to offload tool_result to file:`, err)
          }
        }
        continue
      }

      // --- Handle array content (text + image blocks) ---
      if (Array.isArray(toolResult.content)) {
        type ToolResultContentItem =
          | Anthropic.TextBlockParam
          | Anthropic.ImageBlockParam
          | Anthropic.DocumentBlockParam
          | Anthropic.SearchResultBlockParam
        const newBlocks: ToolResultContentItem[] = []
        let blockModified = false

        for (const item of toolResult.content) {
          // Offload base64 images to files
          if (item.type === 'image') {
            const imageBlock = item as Anthropic.ImageBlockParam
            if (imageBlock.source.type === 'base64') {
              try {
                const filePath = await offloadImageToFile(
                  imageBlock.source.data,
                  imageBlock.source.media_type,
                  toolName,
                  toolUseId
                )
                newBlocks.push({
                  type: 'text',
                  text: buildFileReference(filePath, 0, 'image')
                })
                blockModified = true
                console.log(`[Context] Offloaded image to file: ${filePath} (tool: ${toolName})`)
              } catch (err) {
                console.error(`[Context] Failed to offload image to file:`, err)
                newBlocks.push(item)
              }
            } else {
              // URL-based image: just note the URL, don't keep in context
              const urlSource = imageBlock.source as { url?: string }
              newBlocks.push({
                type: 'text',
                text: `[Image reference: ${urlSource.url || 'unknown URL'}]`
              })
              blockModified = true
            }
            continue
          }

          // Offload large text blocks to files
          if (item.type === 'text') {
            if (item.text.length > TOOL_RESULT_FILE_THRESHOLD) {
              try {
                const filePath = await offloadTextToFile(item.text, toolName, toolUseId)
                newBlocks.push({
                  type: 'text',
                  text: buildFileReference(filePath, item.text.length, 'text')
                })
                blockModified = true
                console.log(`[Context] Offloaded text block to file: ${filePath} (${item.text.length} chars, tool: ${toolName})`)
              } catch (err) {
                console.error(`[Context] Failed to offload text to file:`, err)
                newBlocks.push(item)
              }
            } else {
              newBlocks.push(item)
            }
            continue
          }

          // Keep other block types as-is
          newBlocks.push(item)
        }

        if (blockModified) {
          newContent[blockIdx] = {
            ...toolResult,
            content: newBlocks
          } as typeof block
          modified = true
          compactedCount++
        }
        continue
      }
    }

    if (modified) {
      messages[msgIndex] = {
        ...msg,
        content: newContent
      }
    }
  }

  return compactedCount
}

/**
 * Clean up old offloaded files that are no longer referenced.
 * Call this periodically or when clearing conversation history.
 *
 * @param maxAgeMs Maximum age of files to keep (default: 24 hours)
 */
export async function cleanupOffloadedFiles(maxAgeMs: number = 24 * 60 * 60 * 1000): Promise<number> {
  try {
    const dir = path.join(app.getPath('userData'), CONTEXT_OFFLOAD_DIR)
    const files = await fs.readdir(dir)
    const now = Date.now()
    let deletedCount = 0

    for (const file of files) {
      const filePath = path.join(dir, file)
      try {
        const stat = await fs.stat(filePath)
        if (now - stat.mtimeMs > maxAgeMs) {
          await fs.unlink(filePath)
          deletedCount++
        }
      } catch {
        // File may have been already deleted
      }
    }

    if (deletedCount > 0) {
      console.log(`[Context] Cleaned up ${deletedCount} old offloaded files`)
    }
    return deletedCount
  } catch {
    // Directory may not exist yet
    return 0
  }
}
