import { loadSettings } from '../config/settings.config'
import { localMemoryControlService } from '../services/local-memory-control.service'

type ToolResult = { success: boolean; data?: unknown; error?: string }

export interface MemuConfig {
  baseUrl: string
  apiKey: string
  userId: string
  agentId: string
}

async function getMemuConfig(): Promise<MemuConfig> {
  const settings = await loadSettings()

  return {
    baseUrl: settings.memuBaseUrl,
    apiKey: settings.memuApiKey,
    userId: settings.memuUserId,
    agentId: settings.memuAgentId
  }
}

function hasRemoteConfig(config: MemuConfig): boolean {
  return !!(config.apiKey && config.apiKey.trim())
}

async function executeLocalMemory(query: string): Promise<ToolResult> {
  try {
    const results = await localMemoryControlService.searchMemories({
      query,
      limit: 10,
      include_archived: false,
      exclude_sensitive: true,
      min_confidence: 0.2,
    })

    return {
      success: true,
      data: {
        source: 'local-controlled-memory',
        query,
        results,
      },
    }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

export async function executeMemuMemory(query: string): Promise<ToolResult> {
  try {
    const memuConfig = await getMemuConfig()

    if (!hasRemoteConfig(memuConfig)) {
      return await executeLocalMemory(query)
    }

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

    let result: unknown = null
    try {
      result = await response.json()
    } catch {
      result = null
    }

    if (!response.ok) {
      const message =
        typeof result === 'object' && result && 'message' in result && typeof (result as { message?: unknown }).message === 'string'
          ? (result as { message: string }).message
          : `memU retrieve failed with HTTP ${response.status}`
      return { success: false, error: message }
    }

    return { success: true, data: result }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

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
