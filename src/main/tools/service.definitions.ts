import Anthropic from '@anthropic-ai/sdk'

/**
 * Service management tools for agent
 * Allows agent to create, start, stop, and manage background services
 */

export const serviceTools: Anthropic.Tool[] = [
  {
    name: 'service_create',
    description: `Create a new background service. This creates a service directory with metadata.
After calling this tool, you MUST write the service code to the returned servicePath.

The service code MUST follow this pattern:
1. Import http/https for making requests
2. Define the monitoring/task logic
3. When triggered, call the invoke API at MEMU_API_URL with context and data
4. The invoke API will evaluate and decide whether to notify the user

Environment variables available to the service:
- MEMU_SERVICE_ID: The service ID
- MEMU_API_URL: The local API URL (http://127.0.0.1:31415)`,
    input_schema: {
      type: 'object' as const,
      properties: {
        name: {
          type: 'string',
          description: 'Human-readable name for the service (e.g., "Stock Monitor", "Weather Alert")'
        },
        description: {
          type: 'string',
          description: 'Description of what the service does'
        },
        type: {
          type: 'string',
          enum: ['longRunning', 'scheduled'],
          description: 'Service type: "longRunning" for continuous services, "scheduled" for periodic tasks'
        },
        runtime: {
          type: 'string',
          enum: ['node', 'python'],
          description: 'Runtime environment: "node" for JavaScript/Node.js, "python" for Python'
        },
        entryFile: {
          type: 'string',
          description: 'Entry file name (e.g., "index.js" for Node, "main.py" for Python)'
        },
        schedule: {
          type: 'string',
          description: 'For scheduled services: cron-like interval (e.g., "*/5" for every 5 minutes). Optional for longRunning.'
        },
        userRequest: {
          type: 'string',
          description: 'The original user request that triggered service creation'
        },
        expectation: {
          type: 'string',
          description: 'What the user expects from this service (used for notification decisions)'
        },
        notifyPlatform: {
          type: 'string',
          description: 'Platform to notify user on (telegram, discord, slack, whatsapp, line). Optional.'
        }
      },
      required: ['name', 'description', 'type', 'runtime', 'entryFile', 'userRequest', 'expectation']
    }
  },
  {
    name: 'service_list',
    description: 'List all services and their status (running/stopped)',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: []
    }
  },
  {
    name: 'service_start',
    description: 'Start a service by its ID',
    input_schema: {
      type: 'object' as const,
      properties: {
        serviceId: {
          type: 'string',
          description: 'The service ID to start'
        }
      },
      required: ['serviceId']
    }
  },
  {
    name: 'service_stop',
    description: 'Stop a running service by its ID',
    input_schema: {
      type: 'object' as const,
      properties: {
        serviceId: {
          type: 'string',
          description: 'The service ID to stop'
        }
      },
      required: ['serviceId']
    }
  },
  {
    name: 'service_delete',
    description: 'Delete a service (stops it first if running)',
    input_schema: {
      type: 'object' as const,
      properties: {
        serviceId: {
          type: 'string',
          description: 'The service ID to delete'
        }
      },
      required: ['serviceId']
    }
  },
  {
    name: 'service_get_info',
    description: 'Get detailed information about a specific service',
    input_schema: {
      type: 'object' as const,
      properties: {
        serviceId: {
          type: 'string',
          description: 'The service ID to get info for'
        }
      },
      required: ['serviceId']
    }
  }
]
