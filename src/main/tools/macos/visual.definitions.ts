import type Anthropic from '@anthropic-ai/sdk'
import { platform } from 'os'

/**
 * Check if running on macOS
 */
export function isMacOS(): boolean {
  return platform() === 'darwin'
}

/**
 * Visual demo tool - Opens and focuses macOS apps with optional content targeting
 * Used to create visual demonstrations of Agent workflow
 */
export const macosShowTool: Anthropic.Tool = {
  name: 'macos_show',
  description: `Open and focus a macOS app with optional content targeting for visual demonstration.

This tool creates an immersive visual experience by opening apps and navigating to specific content before performing actual operations.

**Available apps:**
- **mail**: Open Mail.app and optionally search/select a specific email
- **calendar**: Open Calendar.app and navigate to a specific date
- **notes**: Open Notes.app and optionally search for a specific note
- **finder**: Open Finder at a specific folder path, or preview a specific file
- **keynote**: Open Keynote.app with an optional presentation file

**Usage pattern:**
1. Call macos_show BEFORE reading data to display the source app
2. Call macos_show BEFORE creating content to display the target app
3. Then use bash/AppleScript for actual data operations

This creates a visual demonstration where users can see the Agent working across apps.`,
  input_schema: {
    type: 'object',
    properties: {
      app: {
        type: 'string',
        enum: ['mail', 'calendar', 'notes', 'finder', 'keynote'],
        description: 'The macOS app to open and focus'
      },
      target: {
        type: 'object',
        description: 'Optional: specific content to focus on within the app',
        properties: {
          // For Mail
          email_subject: {
            type: 'string',
            description: 'Search and select email containing this subject (for mail app)'
          },
          // For Calendar
          date: {
            type: 'string',
            description: 'Navigate to this date in ISO format, e.g., "2024-01-15" (for calendar app)'
          },
          // For Notes
          note_title: {
            type: 'string',
            description: 'Search and open note containing this title (for notes app)'
          },
          // For Finder
          folder_path: {
            type: 'string',
            description: 'Open Finder at this folder path (for finder app)'
          },
          file_path: {
            type: 'string',
            description: 'Open and preview this specific file with Quick Look (for finder app)'
          },
          // For Keynote
          presentation_path: {
            type: 'string',
            description: 'Open this Keynote presentation file (for keynote app)'
          }
        }
      },
      delay_ms: {
        type: 'number',
        description: 'Optional: delay in milliseconds after opening the app (default: 500ms). Useful for visual pacing.'
      }
    },
    required: ['app']
  }
}

/**
 * Visual close tool - Closes app windows for visual demonstration
 */
export const macosCloseTool: Anthropic.Tool = {
  name: 'macos_close',
  description: `Close an app window or dismiss Quick Look preview for visual demonstration.

Use this after reading/processing content to create a clean visual flow:
1. Open app/file with macos_show
2. Read content with bash
3. Close with macos_close

**Available targets:**
- **finder**: Close the frontmost Finder window
- **quicklook**: Dismiss any open Quick Look preview (press Escape)
- **keynote**: Close the frontmost Keynote window (without quitting the app)
- **mail**: Close the frontmost Mail window
- **calendar**: Close the frontmost Calendar window
- **notes**: Close the frontmost Notes window`,
  input_schema: {
    type: 'object',
    properties: {
      target: {
        type: 'string',
        enum: ['finder', 'quicklook', 'keynote', 'mail', 'calendar', 'notes'],
        description: 'What to close'
      },
      delay_ms: {
        type: 'number',
        description: 'Optional: delay in milliseconds after closing (default: 300ms)'
      }
    },
    required: ['target']
  }
}

/**
 * Get visual demo tools (only if running on macOS)
 * This function is called conditionally based on experimentalVisualMode setting
 */
export function getVisualTools(): Anthropic.Tool[] {
  if (!isMacOS()) {
    return []
  }
  return [macosShowTool, macosCloseTool]
}
