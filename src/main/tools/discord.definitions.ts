import Anthropic from '@anthropic-ai/sdk'

/**
 * Discord tool definitions for Claude Agent
 * These tools allow the agent to send various types of content via Discord
 */
export const discordTools: Anthropic.Tool[] = [
  {
    name: 'discord_send_text',
    description:
      'Send a text message to the current Discord channel. Supports Discord markdown formatting.',
    input_schema: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description: 'The text message to send (max 2000 characters)'
        }
      },
      required: ['text']
    }
  },
  {
    name: 'discord_send_embed',
    description:
      'Send a rich embed message to the current Discord channel. Useful for formatted content.',
    input_schema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Optional: Title of the embed'
        },
        description: {
          type: 'string',
          description: 'Optional: Main text content of the embed (max 4096 characters)'
        },
        color: {
          type: 'number',
          description: 'Optional: Color of the embed sidebar (decimal color value)'
        },
        url: {
          type: 'string',
          description: 'Optional: URL linked from the title'
        },
        footer: {
          type: 'string',
          description: 'Optional: Footer text'
        },
        thumbnail_url: {
          type: 'string',
          description: 'Optional: URL of thumbnail image'
        },
        image_url: {
          type: 'string',
          description: 'Optional: URL of main image'
        },
        fields: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Field name' },
              value: { type: 'string', description: 'Field value' },
              inline: { type: 'boolean', description: 'Whether to display inline' }
            },
            required: ['name', 'value']
          },
          description: 'Optional: Array of fields to display'
        }
      },
      required: []
    }
  },
  {
    name: 'discord_send_file',
    description: 'Send a file attachment to the current Discord channel.',
    input_schema: {
      type: 'object',
      properties: {
        file_path: {
          type: 'string',
          description: 'Absolute path to the file to send'
        },
        filename: {
          type: 'string',
          description: 'Optional: Custom filename to display'
        },
        description: {
          type: 'string',
          description: 'Optional: Description/caption for the file'
        }
      },
      required: ['file_path']
    }
  },
  {
    name: 'discord_send_image',
    description: 'Send an image to the current Discord channel.',
    input_schema: {
      type: 'object',
      properties: {
        image: {
          type: 'string',
          description: 'File path (absolute) or URL of the image to send'
        },
        filename: {
          type: 'string',
          description: 'Optional: Custom filename'
        },
        description: {
          type: 'string',
          description: 'Optional: Description/caption for the image'
        }
      },
      required: ['image']
    }
  },
  {
    name: 'discord_reply',
    description: 'Reply to a specific message in the current Discord channel.',
    input_schema: {
      type: 'object',
      properties: {
        message_id: {
          type: 'string',
          description: 'The ID of the message to reply to'
        },
        text: {
          type: 'string',
          description: 'The reply text content'
        }
      },
      required: ['message_id', 'text']
    }
  },
  {
    name: 'discord_add_reaction',
    description: 'Add a reaction emoji to a message.',
    input_schema: {
      type: 'object',
      properties: {
        message_id: {
          type: 'string',
          description: 'The ID of the message to react to'
        },
        emoji: {
          type: 'string',
          description: 'The emoji to react with (e.g., "👍", "❤️", or custom emoji name)'
        }
      },
      required: ['message_id', 'emoji']
    }
  },
  {
    name: 'discord_typing',
    description: 'Show typing indicator in the current Discord channel.',
    input_schema: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'discord_delete_chat_history',
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
          description: "Delete mode: 'count' = delete last N messages, 'time_range' = delete messages within datetime range, 'all' = clear all messages"
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
