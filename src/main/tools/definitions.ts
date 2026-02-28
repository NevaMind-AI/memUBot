import Anthropic from '@anthropic-ai/sdk'

/**
 * Tool definitions for Claude Agent
 * These tools allow the agent to interact with the local file system
 */
export const fileTools: Anthropic.Tool[] = [
  {
    name: 'grep_file',
    description: 'Search for a pattern in a file or directory. Returns matching lines with line numbers. Use this BEFORE read_file to find relevant code sections, then use read_file with line range to get context. This is much more efficient than reading entire files.',
    input_schema: {
      type: 'object',
      properties: {
        pattern: {
          type: 'string',
          description: 'Search pattern (supports regex)'
        },
        path: {
          type: 'string',
          description: 'File or directory path to search in'
        },
        max_results: {
          type: 'number',
          description: 'Maximum number of results to return (default: 20)'
        }
      },
      required: ['pattern', 'path']
    }
  },
  {
    name: 'read_file',
    description: 'Read file contents. Supports optional line range for large files - prefer using grep_file first to find relevant line numbers, then read only the needed section. Output includes line numbers for easy reference.',
    input_schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'The absolute or relative path to the file to read'
        },
        start_line: {
          type: 'number',
          description: 'Start line number (1-based, optional). If omitted, reads from beginning.'
        },
        end_line: {
          type: 'number',
          description: 'End line number (1-based, optional). If omitted, reads to end.'
        }
      },
      required: ['path']
    }
  },
  {
    name: 'write_file',
    description: 'Write content to a file at the specified path. Creates the file if it does not exist.',
    input_schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'The absolute or relative path to the file to write'
        },
        content: {
          type: 'string',
          description: 'The content to write to the file'
        }
      },
      required: ['path', 'content']
    }
  },
  {
    name: 'list_directory',
    description: 'List all files and directories in the specified directory',
    input_schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'The absolute or relative path to the directory to list'
        }
      },
      required: ['path']
    }
  },
  {
    name: 'delete_file',
    description: 'Delete a file or directory at the specified path',
    input_schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'The absolute or relative path to the file or directory to delete'
        }
      },
      required: ['path']
    }
  },
  {
    name: 'create_directory',
    description: 'Create a new directory at the specified path',
    input_schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'The absolute or relative path to the directory to create'
        }
      },
      required: ['path']
    }
  },
  {
    name: 'get_file_info',
    description: 'Get information about a file or directory (size, dates, etc.)',
    input_schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'The absolute or relative path to the file or directory'
        }
      },
      required: ['path']
    }
  }
]
