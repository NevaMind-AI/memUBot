import Anthropic from '@anthropic-ai/sdk'

/**
 * Yumi tool definitions for Claude Agent
 * These tools allow the agent to send messages via Easemob IM
 *
 * Yumi uses Easemob SDK which supports:
 * - Text messages
 * - Image messages (via URL)
 * - File messages (via URL)
 */
export const yumiTools: Anthropic.Tool[] = [
  {
    name: 'yumi_send_text',
    description:
      'Send a text message to the current Yumi chat. Use this tool ONLY when you need to send a message during tool execution (e.g., progress updates) or when sending multiple separate messages. For normal replies, simply respond with text directly without using this tool.',
    input_schema: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description: 'The text message to send'
        }
      },
      required: ['text']
    }
  },
  {
    name: 'yumi_send_image',
    description:
      'Send an image to the current Yumi chat. ALWAYS use this tool for image files (jpg, jpeg, png, gif, webp, bmp, svg, etc.), regardless of file size. Can send by local file path or URL.',
    input_schema: {
      type: 'object',
      properties: {
        image: {
          type: 'string',
          description: 'File path (absolute) or URL of the image to send'
        },
        filename: {
          type: 'string',
          description: 'Optional: Filename to display for the image'
        },
        width: {
          type: 'number',
          description: 'Optional: Image width in pixels'
        },
        height: {
          type: 'number',
          description: 'Optional: Image height in pixels'
        }
      },
      required: ['image']
    }
  },
  {
    name: 'yumi_send_file',
    description:
      'Send a non-image file (document, archive, audio, video, etc.) to the current Yumi chat. Do NOT use this for image files - use yumi_send_image instead. Can send by local file path or URL.',
    input_schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          description: 'File path (absolute) or URL of the file to send'
        },
        filename: {
          type: 'string',
          description: 'Optional: Custom filename to display'
        },
        file_size: {
          type: 'number',
          description: 'Optional: File size in bytes'
        }
      },
      required: ['file']
    }
  },
  {
    name: 'yumi_delete_chat_history',
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
          description:
            "Delete mode: 'count' = delete last N messages, 'time_range' = delete messages within date range, 'all' = clear all messages"
        },
        count: {
          type: 'number',
          description:
            "Number of messages to delete from the end (for mode='count'). IMPORTANT: If you asked for confirmation, add 3 to the user's requested count."
        },
        start_datetime: {
          type: 'string',
          description:
            "Start datetime in ISO 8601 format with timezone, e.g. '2026-02-04T22:00:00+08:00' (for mode='time_range')"
        },
        end_datetime: {
          type: 'string',
          description:
            "End datetime in ISO 8601 format with timezone, or 'now' for current time (for mode='time_range')"
        }
      },
      required: ['mode']
    }
  }
]
