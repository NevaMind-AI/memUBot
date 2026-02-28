import Anthropic from '@anthropic-ai/sdk'

/**
 * Line tool definitions for Claude Agent
 * These tools allow the agent to send various types of content via Line
 */
export const lineTools: Anthropic.Tool[] = [
  {
    name: 'line_send_text',
    description: 'Send a text message to the current Line chat.',
    input_schema: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description: 'The text message to send (max 5000 characters)'
        }
      },
      required: ['text']
    }
  },
  {
    name: 'line_send_image',
    description: 'Send an image to the current Line chat.',
    input_schema: {
      type: 'object',
      properties: {
        original_url: {
          type: 'string',
          description: 'URL of the original image (HTTPS required)'
        },
        preview_url: {
          type: 'string',
          description: 'URL of the preview image (HTTPS required)'
        }
      },
      required: ['original_url', 'preview_url']
    }
  },
  {
    name: 'line_send_sticker',
    description: 'Send a sticker to the current Line chat.',
    input_schema: {
      type: 'object',
      properties: {
        package_id: {
          type: 'string',
          description: 'Package ID of the sticker'
        },
        sticker_id: {
          type: 'string',
          description: 'Sticker ID'
        }
      },
      required: ['package_id', 'sticker_id']
    }
  },
  {
    name: 'line_send_location',
    description: 'Send a location to the current Line chat.',
    input_schema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Title of the location (max 100 characters)'
        },
        address: {
          type: 'string',
          description: 'Address of the location (max 100 characters)'
        },
        latitude: {
          type: 'number',
          description: 'Latitude of the location'
        },
        longitude: {
          type: 'number',
          description: 'Longitude of the location'
        }
      },
      required: ['title', 'address', 'latitude', 'longitude']
    }
  },
  {
    name: 'line_send_flex',
    description:
      'Send a Flex Message (rich interactive message) to the current Line chat.',
    input_schema: {
      type: 'object',
      properties: {
        alt_text: {
          type: 'string',
          description: 'Alternative text shown in notifications (max 400 characters)'
        },
        contents: {
          type: 'object',
          description: 'Flex Message container object (bubble or carousel)'
        }
      },
      required: ['alt_text', 'contents']
    }
  },
  {
    name: 'line_send_buttons',
    description: 'Send a button template message to the current Line chat.',
    input_schema: {
      type: 'object',
      properties: {
        alt_text: {
          type: 'string',
          description: 'Alternative text shown in notifications'
        },
        title: {
          type: 'string',
          description: 'Optional: Title of the template (max 40 characters)'
        },
        text: {
          type: 'string',
          description: 'Message text (max 160 characters)'
        },
        thumbnail_url: {
          type: 'string',
          description: 'Optional: URL of thumbnail image (HTTPS)'
        },
        actions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              type: { type: 'string', enum: ['uri', 'message', 'postback'] },
              label: { type: 'string' },
              uri: { type: 'string' },
              text: { type: 'string' },
              data: { type: 'string' }
            },
            required: ['type', 'label']
          },
          description: 'Array of action buttons (max 4)'
        }
      },
      required: ['alt_text', 'text', 'actions']
    }
  },
  {
    name: 'line_delete_chat_history',
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
