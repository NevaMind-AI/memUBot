import type Anthropic from '@anthropic-ai/sdk'
import { platform } from 'os'

/**
 * Check if running on macOS
 */
export function isMacOS(): boolean {
  return platform() === 'darwin'
}

/**
 * Mail tool - Basic email operations via Apple Mail
 * For complex queries, use bash with AppleScript directly
 */
export const mailTool: Anthropic.Tool = {
  name: 'macos_mail',
  description: `Basic email operations via Apple Mail on macOS.

Available actions:
- list_accounts: List all email accounts configured in Mail
- send_email: Send a new email with optional attachments
- read_email: Read a specific email by index from INBOX
- download_attachment: Download attachment from an email

For complex queries (searching, filtering by date, listing many emails), use bash with AppleScript directly. Example:
\`\`\`bash
osascript -e 'tell application "Mail" to get subject of messages 1 thru 5 of inbox'
\`\`\`

Common AppleScript patterns for Mail:
- Get unread count: \`tell application "Mail" to get unread count of inbox\`
- List mailboxes: \`tell application "Mail" to name of every mailbox\`
- Search by subject: \`tell application "Mail" to get messages of inbox whose subject contains "keyword"\``,
  input_schema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['list_accounts', 'send_email', 'read_email', 'download_attachment'],
        description: 'The action to perform'
      },
      account: {
        type: 'string',
        description: 'Account name for send_email. Use list_accounts to see available accounts.'
      },
      index: {
        type: 'number',
        description: 'Email index (1-based) for read_email/download_attachment'
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
      attachments: {
        type: 'array',
        items: { type: 'string' },
        description: 'Array of file paths to attach when sending email'
      },
      attachment_index: {
        type: 'number',
        description: 'Attachment index (1-based) for download_attachment. If not specified, downloads all.'
      }
    },
    required: ['action']
  }
}

/**
 * Calendar tool - Basic calendar operations via Apple Calendar
 * For complex queries, use bash with AppleScript directly
 */
export const calendarTool: Anthropic.Tool = {
  name: 'macos_calendar',
  description: `Basic calendar operations via Apple Calendar on macOS.

Available actions:
- list_calendars: List all available calendar names
- create_event: Create a new calendar event

For querying events (list, search, filter by date), use bash with AppleScript directly. Example:
\`\`\`bash
osascript -e 'tell application "Calendar" to get summary of events of calendar "Work"'
\`\`\`

Common AppleScript patterns for Calendar:
- List calendar names: \`tell application "Calendar" to name of every calendar\`
- Get events from specific calendar: \`tell application "Calendar" to get events of calendar "CalendarName"\`
- Get event properties: \`summary\`, \`start date\`, \`end date\`, \`location\`, \`uid\`
- Filter by date: \`every event of calendar "X" whose start date >= (current date)\``,
  input_schema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['list_calendars', 'create_event'],
        description: 'The action to perform'
      },
      calendar: {
        type: 'string',
        description: 'Calendar name for create_event (uses default if not specified)'
      },
      title: {
        type: 'string',
        description: 'Event title for create_event'
      },
      start_date: {
        type: 'string',
        description: 'Start date/time in ISO format (e.g., "2024-01-15T10:00:00")'
      },
      end_date: {
        type: 'string',
        description: 'End date/time in ISO format'
      },
      location: {
        type: 'string',
        description: 'Event location'
      },
      notes: {
        type: 'string',
        description: 'Event notes/description'
      },
      all_day: {
        type: 'boolean',
        description: 'Whether the event is all-day (default: false)'
      }
    },
    required: ['action']
  }
}

/**
 * Contacts tool - Basic contact operations via Apple Contacts
 * For complex queries, use bash with AppleScript directly
 */
export const contactsTool: Anthropic.Tool = {
  name: 'macos_contacts',
  description: `Basic contact operations via Apple Contacts on macOS. Read-only.

Available actions:
- search_contacts: Search contacts by name (fast, recommended)
- get_contact: Get full details of a specific contact by ID

For listing all contacts or complex queries, use bash with AppleScript directly. Example:
\`\`\`bash
osascript -e 'tell application "Contacts" to get name of every person'
\`\`\`

Common AppleScript patterns for Contacts:
- Get all names: \`tell application "Contacts" to name of every person\`
- Get phones: \`tell application "Contacts" to get value of phones of person "Name"\`
- Get emails: \`tell application "Contacts" to get value of emails of person "Name"\`
- Get birthday: \`tell application "Contacts" to get birth date of person "Name"\`
- Search: \`every person whose name contains "keyword"\``,
  input_schema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['search_contacts', 'get_contact'],
        description: 'The action to perform'
      },
      query: {
        type: 'string',
        description: 'Search query for search_contacts (matches name)'
      },
      contact_id: {
        type: 'string',
        description: 'Contact ID for get_contact action'
      }
    },
    required: ['action']
  }
}

/**
 * App launcher tool - Ensure macOS apps are running before AppleScript operations
 * Essential when using bash to run AppleScript directly
 */
export const appLauncherTool: Anthropic.Tool = {
  name: 'macos_launch_app',
  description: `Ensure a macOS app is running and ready before executing AppleScript commands.

**IMPORTANT**: Call this tool BEFORE using bash with AppleScript to interact with macOS apps like Mail, Calendar, or Contacts. AppleScript will fail with error -600 if the app is not running.

Supported apps: Mail, Calendar, Contacts, Safari, Notes, Reminders, Messages, Music, or any macOS app name.

Example workflow:
1. Call macos_launch_app with app_name="Contacts"
2. Then use bash with AppleScript: \`osascript -e 'tell application "Contacts" to ...'\``,
  input_schema: {
    type: 'object',
    properties: {
      app_name: {
        type: 'string',
        description: 'Name of the macOS app to launch (e.g., "Mail", "Calendar", "Contacts", "Safari")'
      }
    },
    required: ['app_name']
  }
}

/**
 * Get all macOS-specific tools (only if running on macOS)
 */
export function getMacOSTools(): Anthropic.Tool[] {
  if (!isMacOS()) {
    return []
  }
  return [appLauncherTool, mailTool, calendarTool, contactsTool]
}
