import type Anthropic from '@anthropic-ai/sdk'

/**
 * Computer Use tool definitions for Claude
 * These tools allow the AI to control the computer
 */

// Computer tool - for mouse, keyboard, and screenshot operations
export const computerTool: Anthropic.Tool = {
  name: 'computer',
  description: `Use a mouse and keyboard to interact with a computer screen. This is an interface to a desktop GUI.
  
Available actions:
- screenshot: Take a screenshot of the current screen
- mouse_move: Move mouse to specific coordinates
- left_click: Left click at current or specified position
- right_click: Right click at current or specified position
- double_click: Double click at current or specified position
- type: Type text using the keyboard
- key: Press a specific key or key combination (e.g., "enter", "ctrl+c", "cmd+v")
- scroll: Scroll up or down at the current position`,
  input_schema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: [
          'screenshot',
          'mouse_move',
          'left_click',
          'right_click',
          'double_click',
          'type',
          'key',
          'scroll'
        ],
        description: 'The action to perform'
      },
      coordinate: {
        type: 'array',
        items: { type: 'number' },
        description: 'The [x, y] coordinates for mouse actions'
      },
      text: {
        type: 'string',
        description: 'The text to type (for "type" action) or key to press (for "key" action)'
      },
      scroll_direction: {
        type: 'string',
        enum: ['up', 'down'],
        description: 'Direction to scroll (for "scroll" action)'
      },
      scroll_amount: {
        type: 'number',
        description: 'Amount to scroll in pixels (default: 500)'
      }
    },
    required: ['action']
  }
}

// Bash tool - for executing shell commands
export const bashTool: Anthropic.Tool = {
  name: 'bash',
  description: `Execute a bash command on the system. Use this for running shell commands, installing packages, managing files via command line, etc.
  
Important notes:
- Commands run in the user's default shell
- Working directory persists between calls
- Long-running commands will timeout after 30 seconds
- Use for: file operations, git commands, npm/yarn, system info, etc.`,
  input_schema: {
    type: 'object',
    properties: {
      command: {
        type: 'string',
        description: 'The bash command to execute'
      },
      timeout: {
        type: 'number',
        description: 'Timeout in milliseconds (default: 30000)'
      }
    },
    required: ['command']
  }
}

// Download file tool - for downloading files from URLs
export const downloadFileTool: Anthropic.Tool = {
  name: 'download_file',
  description: `Download a file from a URL to local storage. Use this for downloading images, documents, or other files from the internet.

Important notes:
- Supports HTTP/HTTPS URLs
- Automatically detects filename from URL or Content-Disposition header
- Files are saved to the agent's output directory by default
- Returns the local file path after successful download
- Useful for: downloading images, PDFs, media files, etc.`,
  input_schema: {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        description: 'The URL of the file to download'
      },
      filename: {
        type: 'string',
        description: 'Optional: Custom filename to save as (if not provided, will be extracted from URL)'
      },
      output_dir: {
        type: 'string',
        description: 'Optional: Custom output directory (defaults to agent output directory)'
      }
    },
    required: ['url']
  }
}

// Text editor tool - for viewing and editing files
export const textEditorTool: Anthropic.Tool = {
  name: 'str_replace_editor',
  description: `A tool for viewing and editing files. Use this for precise text editing operations.

Available commands:
- view: View file contents (optionally with line range)
- create: Create a new file with content
- str_replace: Replace exact text in a file (must match exactly)
- insert: Insert text at a specific line number`,
  input_schema: {
    type: 'object',
    properties: {
      command: {
        type: 'string',
        enum: ['view', 'create', 'str_replace', 'insert'],
        description: 'The command to execute'
      },
      path: {
        type: 'string',
        description: 'Absolute path to the file'
      },
      file_text: {
        type: 'string',
        description: 'Content for creating a new file (for "create" command)'
      },
      old_str: {
        type: 'string',
        description: 'Text to find and replace (for "str_replace" command)'
      },
      new_str: {
        type: 'string',
        description: 'Replacement text (for "str_replace" command)'
      },
      insert_line: {
        type: 'number',
        description: 'Line number to insert at (for "insert" command)'
      },
      view_range: {
        type: 'array',
        items: { type: 'number' },
        description: 'Line range [start, end] for viewing (for "view" command)'
      }
    },
    required: ['command', 'path']
  }
}

// Web search tool - powered by Tavily AI search
export const webSearchTool: Anthropic.Tool = {
  name: 'web_search',
  description: `Search the web using Tavily AI-powered search. This is a reliable search tool that returns comprehensive results with full content excerpts (not just snippets).

Returns search results with:
- Title and URL
- Full content excerpt (detailed summary of the page content)
- Relevance score

This is a high-quality search tool. Use it confidently for:
- Finding current/recent information
- Researching any topic
- Looking up facts, definitions, tutorials
- Finding news and updates
- Getting detailed information from multiple sources

Note: If search returns no useful results after 2-3 attempts with different keywords, consider alternative approaches (ask user for more context, use your built-in knowledge, etc.)`,
  input_schema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'The search query'
      },
      max_results: {
        type: 'number',
        description: 'Maximum number of results to return (default: 5, max: 10)'
      }
    },
    required: ['query']
  }
}

// Export all computer use tools
// Note: computerTool (screenshot, mouse, keyboard) is disabled for stability
// Available: bash, text editor, download, and web search
export const computerUseTools: Anthropic.Tool[] = [bashTool, textEditorTool, downloadFileTool, webSearchTool]
