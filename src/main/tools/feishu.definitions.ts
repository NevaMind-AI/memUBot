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
  }
]
