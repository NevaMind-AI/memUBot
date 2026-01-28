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
  }
]
