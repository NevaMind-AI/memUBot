import type Anthropic from '@anthropic-ai/sdk'
import { platform } from 'os'

/**
 * Check if running on macOS
 */
export function isMacOS(): boolean {
  return platform() === 'darwin'
}

/**
 * Mail tool - Read and send emails via Apple Mail
 */
export const mailTool: Anthropic.Tool = {
  name: 'macos_mail',
  description: `Interact with Apple Mail app on macOS. Can read emails, send emails, and search mailboxes.

Available actions:
- list_accounts: List all email accounts configured in Mail
- list_mailboxes: List all available mailboxes/folders
- list_emails: List emails from a mailbox (default: INBOX)
- read_email: Read a specific email by index
- send_email: Send a new email (can specify which account to send from)
- search_emails: Search emails by subject or sender

IMPORTANT: Use list_accounts first to see available accounts, then specify the account name when sending emails.`,
  input_schema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['list_accounts', 'list_mailboxes', 'list_emails', 'read_email', 'send_email', 'search_emails'],
        description: 'The action to perform'
      },
      account: {
        type: 'string',
        description: 'Account name to use for sending emails (e.g., "谷歌", "163"). Use list_accounts to see available accounts. If not specified, uses the default account.'
      },
      mailbox: {
        type: 'string',
        description: 'Mailbox name (default: INBOX). Use for list_emails, read_email, search_emails'
      },
      index: {
        type: 'number',
        description: 'Email index (1-based) for read_email action'
      },
      count: {
        type: 'number',
        description: 'Number of emails to list (default: 10, max: 50)'
      },
      to: {
        type: 'string',
        description: 'Recipient email address for send_email'
      },
      subject: {
        type: 'string',
        description: 'Email subject for send_email'
      },
      body: {
        type: 'string',
        description: 'Email body content for send_email'
      },
      query: {
        type: 'string',
        description: 'Search query for search_emails (searches subject and sender)'
      }
    },
    required: ['action']
  }
}

/**
 * Calendar tool - Manage calendar events via Apple Calendar
 */
export const calendarTool: Anthropic.Tool = {
  name: 'macos_calendar',
  description: `Interact with Apple Calendar app on macOS. Can list calendars, view events, and create new events.

Available actions:
- list_calendars: List all available calendars
- list_events: List upcoming events (optionally filter by calendar)
- get_event: Get details of a specific event
- create_event: Create a new calendar event
- search_events: Search events by title

Note: Uses calendars configured in Apple Calendar (including iCloud, Google, etc).`,
  input_schema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['list_calendars', 'list_events', 'get_event', 'create_event', 'search_events'],
        description: 'The action to perform'
      },
      calendar: {
        type: 'string',
        description: 'Calendar name (uses default calendar if not specified)'
      },
      days: {
        type: 'number',
        description: 'Number of days to look ahead for list_events (default: 7)'
      },
      event_id: {
        type: 'string',
        description: 'Event ID for get_event action'
      },
      title: {
        type: 'string',
        description: 'Event title for create_event'
      },
      start_date: {
        type: 'string',
        description: 'Start date/time in ISO format (e.g., "2024-01-15T10:00:00") for create_event'
      },
      end_date: {
        type: 'string',
        description: 'End date/time in ISO format for create_event'
      },
      location: {
        type: 'string',
        description: 'Event location for create_event'
      },
      notes: {
        type: 'string',
        description: 'Event notes/description for create_event'
      },
      all_day: {
        type: 'boolean',
        description: 'Whether the event is all-day (default: false)'
      },
      query: {
        type: 'string',
        description: 'Search query for search_events'
      }
    },
    required: ['action']
  }
}

/**
 * Contacts tool - Read contacts from Apple Contacts
 */
export const contactsTool: Anthropic.Tool = {
  name: 'macos_contacts',
  description: `Read contacts from Apple Contacts app on macOS. Can list contacts, search by name, and get contact details.

Available actions:
- list_contacts: List all contacts (with optional limit)
- search_contacts: Search contacts by name, email, or phone
- get_contact: Get full details of a specific contact

Note: Read-only access to contacts. Cannot create or modify contacts.`,
  input_schema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['list_contacts', 'search_contacts', 'get_contact'],
        description: 'The action to perform'
      },
      query: {
        type: 'string',
        description: 'Search query for search_contacts (matches name, email, phone)'
      },
      contact_id: {
        type: 'string',
        description: 'Contact ID for get_contact action'
      },
      limit: {
        type: 'number',
        description: 'Maximum number of contacts to return (default: 20, max: 100)'
      }
    },
    required: ['action']
  }
}

/**
 * Get all macOS-specific tools (only if running on macOS)
 */
export function getMacOSTools(): Anthropic.Tool[] {
  if (!isMacOS()) {
    return []
  }
  return [mailTool, calendarTool, contactsTool]
}
