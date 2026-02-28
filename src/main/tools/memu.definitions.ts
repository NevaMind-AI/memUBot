import type Anthropic from '@anthropic-ai/sdk'

/**
 * Memu tool definitions for memory retrieval
 * Used by the agent to recall facts, past events, or context about the user.
 */
export const memuTools: Anthropic.Tool[] = [
  {
    name: 'memu_memory',
    description: 'Retrieve memory based on a query. Use this to recall facts, past events, or context about the user.',
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
  }
]
