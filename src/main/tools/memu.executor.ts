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
    baseUrl: settings.memuBaseUrl,
    apiKey: settings.memuApiKey,
    userId: settings.memuUserId,
    agentId: settings.memuAgentId
  }
}

/**
 * Execute memu_memory: retrieve memory by query from the Memu API.
 */
export async function executeMemuMemory(query: string): Promise<ToolResult> {
  try {
    const memuConfig = await getMemuConfig()
    const response = await fetch(`${memuConfig.baseUrl}/api/v3/memory/retrieve`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${memuConfig.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        user_id: memuConfig.userId,
        agent_id: memuConfig.agentId,
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
    case 'memu_memory': {
      const { query } = input as { query: string }
      return await executeMemuMemory(query)
    }
    default:
      return { success: false, error: `Unknown Memu tool: ${name}` }
  }
}
