import Anthropic from '@anthropic-ai/sdk'

/**
 * Telegram tool definitions for Claude Agent
 * These tools allow the agent to send various types of content via Telegram
 */
export const telegramTools: Anthropic.Tool[] = [
  {
    name: 'telegram_send_text',
    description:
      'Send a text message to the current Telegram chat. Use standard Markdown formatting (bold, italic, code, links, etc.) - it will be automatically converted for proper display.',
    input_schema: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description: 'The text message to send. Supports Markdown: **bold**, *italic*, `code`, ```code blocks```, [links](url), etc.'
        }
      },
      required: ['text']
    }
  },
  {
    name: 'telegram_send_photo',
    description:
      'Send a photo to the current Telegram chat. Can send by file path or URL.',
    input_schema: {
      type: 'object',
      properties: {
        photo: {
          type: 'string',
          description: 'File path (absolute) or URL of the photo to send'
        },
        caption: {
          type: 'string',
          description: 'Optional: Caption for the photo. Supports Markdown formatting.'
        }
      },
      required: ['photo']
    }
  },
  {
    name: 'telegram_send_document',
    description:
      'Send a document/file to the current Telegram chat. Can send any file type.',
    input_schema: {
      type: 'object',
      properties: {
        document: {
          type: 'string',
          description: 'File path (absolute) or URL of the document to send'
        },
        caption: {
          type: 'string',
          description: 'Optional: Caption for the document'
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
    name: 'telegram_send_video',
    description: 'Send a video to the current Telegram chat.',
    input_schema: {
      type: 'object',
      properties: {
        video: {
          type: 'string',
          description: 'File path (absolute) or URL of the video to send'
        },
        caption: {
          type: 'string',
          description: 'Optional: Caption for the video'
        },
        duration: {
          type: 'number',
          description: 'Optional: Duration of the video in seconds'
        },
        width: {
          type: 'number',
          description: 'Optional: Video width'
        },
        height: {
          type: 'number',
          description: 'Optional: Video height'
        }
      },
      required: ['video']
    }
  },
  {
    name: 'telegram_send_audio',
    description: 'Send an audio file to the current Telegram chat.',
    input_schema: {
      type: 'object',
      properties: {
        audio: {
          type: 'string',
          description: 'File path (absolute) or URL of the audio file to send'
        },
        caption: {
          type: 'string',
          description: 'Optional: Caption for the audio'
        },
        duration: {
          type: 'number',
          description: 'Optional: Duration of the audio in seconds'
        },
        performer: {
          type: 'string',
          description: 'Optional: Performer name'
        },
        title: {
          type: 'string',
          description: 'Optional: Track title'
        }
      },
      required: ['audio']
    }
  },
  {
    name: 'telegram_send_voice',
    description: 'Send a voice message to the current Telegram chat. Must be in .ogg format.',
    input_schema: {
      type: 'object',
      properties: {
        voice: {
          type: 'string',
          description: 'File path (absolute) or URL of the voice message (.ogg format)'
        },
        caption: {
          type: 'string',
          description: 'Optional: Caption for the voice message'
        },
        duration: {
          type: 'number',
          description: 'Optional: Duration in seconds'
        }
      },
      required: ['voice']
    }
  },
  {
    name: 'telegram_send_location',
    description: 'Send a location (GPS coordinates) to the current Telegram chat.',
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
        }
      },
      required: ['latitude', 'longitude']
    }
  },
  {
    name: 'telegram_send_contact',
    description: 'Send a contact card to the current Telegram chat.',
    input_schema: {
      type: 'object',
      properties: {
        phone_number: {
          type: 'string',
          description: 'Phone number of the contact'
        },
        first_name: {
          type: 'string',
          description: 'First name of the contact'
        },
        last_name: {
          type: 'string',
          description: 'Optional: Last name of the contact'
        }
      },
      required: ['phone_number', 'first_name']
    }
  },
  {
    name: 'telegram_send_poll',
    description: 'Send a poll to the current Telegram chat.',
    input_schema: {
      type: 'object',
      properties: {
        question: {
          type: 'string',
          description: 'Poll question (1-300 characters)'
        },
        options: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of poll options (2-10 options, each 1-100 characters)'
        },
        is_anonymous: {
          type: 'boolean',
          description: 'Optional: Whether the poll is anonymous (default: true)'
        },
        allows_multiple_answers: {
          type: 'boolean',
          description: 'Optional: Whether multiple answers are allowed (default: false)'
        }
      },
      required: ['question', 'options']
    }
  },
  {
    name: 'telegram_send_sticker',
    description: 'Send a sticker to the current Telegram chat.',
    input_schema: {
      type: 'object',
      properties: {
        sticker: {
          type: 'string',
          description: 'File path, URL, or file_id of the sticker to send'
        }
      },
      required: ['sticker']
    }
  },
  {
    name: 'telegram_send_chat_action',
    description:
      'Send a chat action (like "typing..." indicator) to show the bot is doing something.',
    input_schema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: [
            'typing',
            'upload_photo',
            'upload_video',
            'upload_voice',
            'upload_document',
            'find_location',
            'record_video',
            'record_voice',
            'record_video_note',
            'upload_video_note'
          ],
          description: 'The type of action to show'
        }
      },
      required: ['action']
    }
  }
]
