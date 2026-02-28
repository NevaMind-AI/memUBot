import Anthropic from '@anthropic-ai/sdk'

/**
 * Slack tool definitions for Claude Agent
 * These tools allow the agent to send various types of content via Slack
 */
export const slackTools: Anthropic.Tool[] = [
  {
    name: 'slack_send_text',
    description:
      'Send a text message to the current Slack channel. Supports Slack mrkdwn formatting.',
    input_schema: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description: 'The text message to send (supports mrkdwn)'
        },
        thread_ts: {
          type: 'string',
          description: 'Optional: Thread timestamp to reply in a thread'
        }
      },
      required: ['text']
    }
  },
  {
    name: 'slack_send_blocks',
    description:
      'Send a rich message with Block Kit blocks to the current Slack channel.',
    input_schema: {
      type: 'object',
      properties: {
        blocks: {
          type: 'array',
          items: { type: 'object' },
          description: 'Array of Block Kit block objects'
        },
        text: {
          type: 'string',
          description: 'Fallback text for notifications'
        },
        thread_ts: {
          type: 'string',
          description: 'Optional: Thread timestamp to reply in a thread'
        }
      },
      required: ['blocks']
    }
  },
  {
    name: 'slack_upload_file',
    description: 'Upload a file to the current Slack channel.',
    input_schema: {
      type: 'object',
      properties: {
        file_path: {
          type: 'string',
          description: 'Absolute path to the file to upload'
        },
        filename: {
          type: 'string',
          description: 'Optional: Custom filename to display'
        },
        title: {
          type: 'string',
          description: 'Optional: Title of the file'
        },
        initial_comment: {
          type: 'string',
          description: 'Optional: Comment to add with the file'
        }
      },
      required: ['file_path']
    }
  },
  {
    name: 'slack_add_reaction',
    description: 'Add a reaction emoji to a message.',
    input_schema: {
      type: 'object',
      properties: {
        message_ts: {
          type: 'string',
          description: 'Timestamp of the message to react to'
        },
        emoji: {
          type: 'string',
          description: 'Name of the emoji (without colons, e.g., "thumbsup")'
        }
      },
      required: ['message_ts', 'emoji']
    }
  },
  {
    name: 'slack_send_ephemeral',
    description:
      'Send an ephemeral message visible only to a specific user.',
    input_schema: {
      type: 'object',
      properties: {
        user_id: {
          type: 'string',
          description: 'User ID to send the ephemeral message to'
        },
        text: {
          type: 'string',
          description: 'The text message to send'
        }
      },
      required: ['user_id', 'text']
    }
  },
  {
    name: 'slack_delete_chat_history',
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
