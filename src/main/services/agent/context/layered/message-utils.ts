import type Anthropic from '@anthropic-ai/sdk'
import { normalizeWhitespace } from './text-utils'

function stringifyUnknown(value: unknown): string {
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function flattenBlock(block: Anthropic.ContentBlockParam | Anthropic.ContentBlock): string {
  if (block.type === 'text') {
    return block.text
  }

  if (block.type === 'image') {
    return '[Image content]'
  }

  if (block.type === 'tool_use') {
    return `[Tool use] ${block.name}: ${stringifyUnknown(block.input)}`
  }

  if (block.type === 'tool_result') {
    if (typeof block.content === 'string') {
      return `[Tool result] ${block.content}`
    }
    if (Array.isArray(block.content)) {
      const nested = block.content
        .map((item) => {
          if (item.type === 'text') return item.text
          if (item.type === 'image') return '[Image content]'
          return stringifyUnknown(item)
        })
        .join('\n')
      return `[Tool result]\n${nested}`
    }
    return `[Tool result] ${stringifyUnknown(block.content)}`
  }

  return stringifyUnknown(block)
}

export function flattenMessageContent(message: Anthropic.MessageParam): string {
  if (typeof message.content === 'string') {
    return normalizeWhitespace(message.content)
  }

  const merged = message.content.map((block) => flattenBlock(block)).join('\n')
  return normalizeWhitespace(merged)
}

export function toTranscript(messages: Anthropic.MessageParam[]): string {
  const lines: string[] = []
  for (const msg of messages) {
    const role = msg.role === 'assistant' ? 'ASSISTANT' : 'USER'
    const text = flattenMessageContent(msg)
    if (!text) continue
    lines.push(`${role}: ${text}`)
  }
  return normalizeWhitespace(lines.join('\n\n'))
}

export function splitArchiveMessages(
  messages: Anthropic.MessageParam[],
  chunkSize: number
): Anthropic.MessageParam[][] {
  if (messages.length === 0) return []
  const chunks: Anthropic.MessageParam[][] = []
  let currentChunk: Anthropic.MessageParam[] = []

  for (let i = 0; i < messages.length; i++) {
    const current = messages[i]
    currentChunk.push(current)

    if (currentChunk.length < chunkSize) {
      continue
    }

    // Keep tool_use + tool_result pairs in the same chunk.
    if (typeof current.content !== 'string' && current.content.some((b) => b.type === 'tool_use')) {
      continue
    }

    const next = messages[i + 1]
    if (next && typeof next.content !== 'string' && next.content.some((b) => b.type === 'tool_result')) {
      continue
    }

    chunks.push(currentChunk)
    currentChunk = []
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk)
  }

  return chunks
}

export function getLatestUserQuery(messages: Anthropic.MessageParam[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i]
    if (msg.role !== 'user') continue
    const text = flattenMessageContent(msg)
    if (text) return text
  }
  return ''
}
