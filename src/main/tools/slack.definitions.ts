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
  }
]
