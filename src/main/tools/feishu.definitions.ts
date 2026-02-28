import Anthropic from '@anthropic-ai/sdk'

/**
 * Feishu tool definitions for Claude Agent
 * These tools allow the agent to send various types of content via Feishu
 */
export const feishuTools: Anthropic.Tool[] = [
  {
    name: 'feishu_send_text',
    description:
      'Send a text message to the current Feishu chat. Supports plain text.',
    input_schema: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description: 'The text message to send.'
        }
      },
      required: ['text']
    }
  },
  {
    name: 'feishu_send_image',
    description:
      'Send an image to the current Feishu chat. Must be a local file path.',
    input_schema: {
      type: 'object',
      properties: {
        image: {
          type: 'string',
          description: 'Absolute file path of the image to send'
        }
      },
      required: ['image']
    }
  },
  {
    name: 'feishu_send_file',
    description:
      'Send a file to the current Feishu chat. Can send any file type.',
    input_schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          description: 'Absolute file path of the file to send'
        },
        filename: {
          type: 'string',
          description: 'Optional: Custom filename to display'
        }
      },
      required: ['file']
    }
  },
  {
    name: 'feishu_send_card',
    description:
      'Send an interactive message card to the current Feishu chat. Cards support rich formatting.',
    input_schema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Card header title'
        },
        content: {
          type: 'string',
          description: 'Card content (markdown supported)'
        },
        template: {
          type: 'string',
          enum: ['blue', 'wathet', 'turquoise', 'green', 'yellow', 'orange', 'red', 'carmine', 'violet', 'purple', 'indigo', 'grey'],
          description: 'Optional: Card header color template'
        }
      },
      required: ['title', 'content']
    }
  },
  {
    name: 'feishu_delete_chat_history',
    description: `Delete chat history from local storage. This clears messages from the chat window. 
IMPORTANT: 
- By default, you MUST ask for user confirmation before deleting messages, unless the user explicitly says "no confirmation needed" or similar.
- When user asks to delete "last N messages" AND you asked for confirmation, you MUST add extra messages to the count:
  * User's original request = 1 message
  * Your confirmation question = 1 message  
  * User's confirmation reply = 1 message
  * So: total count = N + 3 (the N messages user wants to delete + 3 messages from the confirmation flow)
  * Example: "delete last 1 message" with confirmation → count = 1 + 3 = 4
- After deletion, the UI will automatically refresh.`,
    input_schema: {
      type: 'object',
      properties: {
        mode: {
          type: 'string',
          enum: ['count', 'time_range', 'all'],
          description: "Delete mode: 'count' = delete last N messages, 'time_range' = delete messages within date range, 'all' = clear all messages"
        },
        count: {
          type: 'number',
          description: "Number of messages to delete from the end (for mode='count'). IMPORTANT: If you asked for confirmation, add 3 to the user's requested count (user request + your confirmation + user reply = 3 extra messages)."
        },
        start_datetime: {
          type: 'string',
          description: "Start datetime in ISO 8601 format with timezone, e.g. '2026-02-04T22:00:00+08:00' or '2026-02-04T14:00:00Z' (for mode='time_range'). MUST include timezone offset or Z for UTC."
        },
        end_datetime: {
          type: 'string',
          description: "End datetime in ISO 8601 format with timezone, e.g. '2026-02-05T10:00:00+08:00' or use 'now' for current time (for mode='time_range'). MUST include timezone offset or Z for UTC."
        }
      },
      required: ['mode']
    }
  }
]
