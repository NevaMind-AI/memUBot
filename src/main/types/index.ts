// Message types for conversation
export interface ConversationMessage {
  role: 'user' | 'assistant'
  content: string
}

// Tool input types
export interface ReadFileInput {
  path: string
}

export interface WriteFileInput {
  path: string
  content: string
}

export interface ListDirectoryInput {
  path: string
}

export interface DeleteFileInput {
  path: string
}

export interface CreateDirectoryInput {
  path: string
}

export interface FileInfoInput {
  path: string
}

// Tool result type
export interface ToolResult {
  success: boolean
  data?: unknown
  error?: string
}

// File info type
export interface FileInfo {
  name: string
  path: string
  isDirectory: boolean
  size: number
  modifiedAt: Date
  createdAt: Date
}

// Agent response type
export interface AgentResponse {
  success: boolean
  message?: string
  error?: string
  busyWith?: string  // Platform currently processing (when rejected due to lock)
}

// IPC response type
export interface IpcResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
}

// Re-export app types
export type { AppPlatform, AppMessage, BotStatus } from '../apps/types'
