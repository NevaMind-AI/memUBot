type ToolResult = { success: boolean; data?: unknown; error?: string }

export interface QmemoryConfig {
  baseUrl: string
  apiKey: string
  userId: string
  agentId: string
}

/**
 * Get Qmemory API config from settings.
 */
async function getQmemoryConfig(): Promise<QmemoryConfig> {
  const { loadSettings } = await import('../config/settings.config')
  const settings = await loadSettings()

  return {
    baseUrl: settings['qmemoryBaseUrl'],
    apiKey: settings['qmemoryApiKey'],
    userId: settings['qmemoryUserId'],
    agentId: settings['qmemoryAgentId']
  }
}

/**
 * Execute 2501_memory: retrieve memory by query from the Qmemory API.
 */
export async function executeQmemoryMemory(query: string): Promise<ToolResult> {
  try {
    const config2501 = await getQmemoryConfig()
    const response = await fetch(`${config2501.baseUrl}/api/v3/memory/retrieve`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config2501.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        user_id: config2501.userId,
        agent_id: config2501.agentId,
        query
      })
    })
    const result = await response.json()
    return { success: true, data: result }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

/**
 * Execute a Qmemory tool by name
 */
export async function executeQmemoryTool(name: string, input: unknown): Promise<ToolResult> {
  switch (name) {
    case '2501_memory': {
      const { query } = input as { query: string }
      return await executeQmemoryMemory(query)
    }
    default:
      return { success: false, error: `Unknown Qmemory tool: ${name}` }
  }
}
