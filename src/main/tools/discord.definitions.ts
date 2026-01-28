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
  }
]
