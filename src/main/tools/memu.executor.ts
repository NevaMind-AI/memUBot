import { getAuthService } from '../services/auth'

type ToolResult = { success: boolean; data?: unknown; error?: string }

export interface MemuConfig {
  baseUrl: string
  apiKey: string
  userId: string
  agentId: string
}

/** App mode: memu (npm run dev:memu) vs yumi (npm run dev:yumi) */
function getAppMode(): 'memu' | 'yumi' {
  return (import.meta.env?.MAIN_VITE_APP_MODE as 'memu' | 'yumi') || 'memu'
}

/**
 * Get Memu API config. In memu mode uses settings; in yumi mode uses settings for baseUrl/userId/agentId and auth service for apiKey.
 */
async function getMemuConfig(): Promise<MemuConfig> {
  const { loadSettings } = await import('../config/settings.config')
  const settings = await loadSettings()
  const mode = getAppMode()

  if (mode === 'memu') {
    return {
      baseUrl: settings.memuBaseUrl,
      apiKey: settings.memuApiKey,
      userId: settings.memuUserId,
      agentId: settings.memuAgentId
    }
  }

  // yumi mode: baseUrl from settings; userId/agentId from yumi-specific settings; apiKey from auth state
  const authState = getAuthService().getAuthState()
  return {
    baseUrl: settings.memuBaseUrl,
    apiKey: authState.memuApiKey ?? '',
    userId: settings.memuYumiUserId,
    agentId: settings.memuYumiAgentId
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
