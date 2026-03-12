type ToolResult = { success: boolean; data?: unknown; error?: string }

export interface MemuConfig {
  baseUrl: string
  apiKey: string
  userId: string
  agentId: string
}

/**
 * Get Memu API config from settings.
 */
async function getMemuConfig(): Promise<MemuConfig> {
  const { loadSettings } = await import('../config/settings.config')
  const settings = await loadSettings()

  return {
    baseUrl: settings['2501BaseUrl'],
    apiKey: settings['2501ApiKey'],
    userId: settings['2501UserId'],
    agentId: settings['2501AgentId']
  }
}

/**
 * Execute 2501_memory: retrieve memory by query from the Memu API.
 */
export async function executeMemuMemory(query: string): Promise<ToolResult> {
  try {
    const 2501Config = await getMemuConfig()
    const response = await fetch(`${2501Config.baseUrl}/api/v3/memory/retrieve`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${2501Config.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        user_id: 2501Config.userId,
        agent_id: 2501Config.agentId,
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
 * Execute a Memu tool by name
 */
export async function executeMemuTool(name: string, input: unknown): Promise<ToolResult> {
  switch (name) {
    case '2501_memory': {
      const { query } = input as { query: string }
      return await executeMemuMemory(query)
    }
    default:
      return { success: false, error: `Unknown Memu tool: ${name}` }
  }
}
