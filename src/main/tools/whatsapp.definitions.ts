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
  }
]
