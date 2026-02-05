import Anthropic from '@anthropic-ai/sdk'

/**
 * WhatsApp tool definitions for Claude Agent
 * These tools allow the agent to send various types of content via WhatsApp
 */
export const whatsappTools: Anthropic.Tool[] = [
  {
    name: 'whatsapp_send_text',
    description:
      'Send a text message to the current WhatsApp chat. Supports emoji and basic formatting.',
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
    name: 'whatsapp_send_image',
    description: 'Send an image to the current WhatsApp chat.',
    input_schema: {
      type: 'object',
      properties: {
        image: {
          type: 'string',
          description: 'File path (absolute) or URL of the image to send'
        },
        caption: {
          type: 'string',
          description: 'Optional: Caption for the image'
        }
      },
      required: ['image']
    }
  },
  {
    name: 'whatsapp_send_document',
    description: 'Send a document/file to the current WhatsApp chat.',
    input_schema: {
      type: 'object',
      properties: {
        document: {
          type: 'string',
          description: 'File path (absolute) or URL of the document to send'
        },
        filename: {
          type: 'string',
          description: 'Optional: Custom filename to display'
        }
      },
      required: ['document']
    }
  },
  {
    name: 'whatsapp_send_location',
    description: 'Send a location to the current WhatsApp chat.',
    input_schema: {
      type: 'object',
      properties: {
        latitude: {
          type: 'number',
          description: 'Latitude of the location'
        },
        longitude: {
          type: 'number',
          description: 'Longitude of the location'
        },
        description: {
          type: 'string',
          description: 'Optional: Description of the location'
        }
      },
      required: ['latitude', 'longitude']
    }
  },
  {
    name: 'whatsapp_send_contact',
    description: 'Send a contact card to the current WhatsApp chat.',
    input_schema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Name of the contact'
        },
        phone_number: {
          type: 'string',
          description: 'Phone number of the contact'
        }
      },
      required: ['name', 'phone_number']
    }
  },
  {
    name: 'whatsapp_delete_chat_history',
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
