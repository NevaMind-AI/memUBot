import { spawn, ChildProcess } from 'child_process'
import { app } from 'electron'
import * as fs from 'fs/promises'
import * as path from 'path'
import * as readline from 'readline'
import type Anthropic from '@anthropic-ai/sdk'

/**
 * MCP Server Configuration
 */
interface McpServerConfig {
  command: string
  args?: string[]
  env?: Record<string, string>
  disabled?: boolean
}

/**
 * MCP Tool Definition (from server)
 */
interface McpToolDefinition {
  name: string
  description?: string
  inputSchema: {
    type: 'object'
    properties?: Record<string, unknown>
    required?: string[]
  }
}

/**
 * MCP JSON-RPC Request
 */
interface JsonRpcRequest {
  jsonrpc: '2.0'
  id: number
  method: string
  params?: unknown
}

/**
 * MCP JSON-RPC Response
 */
interface JsonRpcResponse {
  jsonrpc: '2.0'
  id: number
  result?: unknown
  error?: {
    code: number
    message: string
    data?: unknown
  }
}

/**
 * Connected MCP Server
 */
interface ConnectedServer {
  name: string
  process: ChildProcess
  tools: McpToolDefinition[]
  pendingRequests: Map<number, {
    resolve: (value: unknown) => void
    reject: (error: Error) => void
  }>
  nextId: number
}

/**
 * MCP Service - Manages MCP server connections and tool execution
 */
class McpService {
  private servers: Map<string, ConnectedServer> = new Map()
  private initialized = false

  /**
   * Get the path to the MCP config file
   */
  private getMcpConfigPath(): string {
    return path.join(app.getPath('userData'), 'mcp-config.json')
  }

  /**
   * Load MCP configuration
   */
  private async loadConfig(): Promise<Record<string, McpServerConfig>> {
    try {
      const configPath = this.getMcpConfigPath()
      const content = await fs.readFile(configPath, 'utf-8')
      return JSON.parse(content)
    } catch {
      return {}
    }
  }

  /**
   * Initialize and connect to all configured MCP servers
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return
    }

    console.log('[MCP] Initializing MCP service...')
    const config = await this.loadConfig()

    for (const [name, serverConfig] of Object.entries(config)) {
      if (serverConfig.disabled) {
        console.log(`[MCP] Server ${name} is disabled, skipping`)
        continue
      }

      try {
        await this.connectServer(name, serverConfig)
      } catch (error) {
        console.error(`[MCP] Failed to connect to server ${name}:`, error)
      }
    }

    this.initialized = true
    console.log(`[MCP] Initialized with ${this.servers.size} server(s)`)
  }

  /**
   * Get the MCP output directory (for generated files like images)
   * All MCP servers run with this as their working directory
   */
  getMcpOutputDir(): string {
    return path.join(app.getPath('userData'), 'mcp-output')
  }

  /**
   * Connect to a single MCP server
   */
  private async connectServer(name: string, config: McpServerConfig): Promise<void> {
    console.log(`[MCP] Connecting to server: ${name}`)

    // Ensure MCP output directory exists
    const mcpOutputDir = this.getMcpOutputDir()
    await fs.mkdir(mcpOutputDir, { recursive: true })

    // Merge environment variables with auto-injected ones
    // PATH is already enhanced at app startup (see utils/shell-env.ts)
    const env = {
      ...process.env,
      // Auto-inject output directory for MCP servers (if they support it)
      MCP_OUTPUT_DIR: mcpOutputDir,
      OUTPUT_DIR: mcpOutputDir,
      // Also set HOME-like vars so relative paths like ~/output work
      ...config.env // User config can override these
    }

    // Spawn the server process with cwd set to mcp-output directory
    // This ensures any relative path outputs (like ./output, ./images) 
    // will be created inside the app's data directory
    const proc = spawn(config.command, config.args || [], {
      env,
      cwd: mcpOutputDir, // Key: set working directory to app's mcp-output folder
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true
    })

    const server: ConnectedServer = {
      name,
      process: proc,
      tools: [],
      pendingRequests: new Map(),
      nextId: 1
    }

    // Handle stdout (JSON-RPC responses)
    const rl = readline.createInterface({ input: proc.stdout! })
    rl.on('line', (line) => {
      try {
        const response = JSON.parse(line) as JsonRpcResponse
        const pending = server.pendingRequests.get(response.id)
        if (pending) {
          server.pendingRequests.delete(response.id)
          if (response.error) {
            pending.reject(new Error(response.error.message))
          } else {
            pending.resolve(response.result)
          }
        }
      } catch (error) {
        console.error(`[MCP:${name}] Failed to parse response:`, error)
      }
    })

    // Handle stderr (logs)
    proc.stderr?.on('data', (data) => {
      console.log(`[MCP:${name}] stderr:`, data.toString())
    })

    // Handle process exit
    proc.on('exit', (code) => {
      console.log(`[MCP:${name}] Process exited with code ${code}`)
      this.servers.delete(name)
    })

    proc.on('error', (error) => {
      console.error(`[MCP:${name}] Process error:`, error)
      this.servers.delete(name)
    })

    this.servers.set(name, server)

    // Initialize the server
    await this.sendRequest(server, 'initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: {
        name: 'memu-bot',
        version: '1.0.0'
      }
    })

    // Send initialized notification
    this.sendNotification(server, 'notifications/initialized', {})

    // Get available tools
    const toolsResult = await this.sendRequest(server, 'tools/list', {}) as { tools: McpToolDefinition[] }
    server.tools = toolsResult.tools || []
    console.log(`[MCP:${name}] Loaded ${server.tools.length} tool(s)`)
  }

  /**
   * Send a JSON-RPC request and wait for response
   */
  private sendRequest(server: ConnectedServer, method: string, params?: unknown): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const id = server.nextId++
      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        id,
        method,
        params
      }

      server.pendingRequests.set(id, { resolve, reject })

      const message = JSON.stringify(request) + '\n'
      server.process.stdin?.write(message)

      // Timeout after 30 seconds
      setTimeout(() => {
        if (server.pendingRequests.has(id)) {
          server.pendingRequests.delete(id)
          reject(new Error(`Request ${method} timed out`))
        }
      }, 30000)
    })
  }

  /**
   * Send a JSON-RPC notification (no response expected)
   */
  private sendNotification(server: ConnectedServer, method: string, params?: unknown): void {
    const notification = {
      jsonrpc: '2.0',
      method,
      params
    }
    server.process.stdin?.write(JSON.stringify(notification) + '\n')
  }

  /**
   * Get all available MCP tools in Anthropic format
   */
  getTools(): Anthropic.Tool[] {
    const tools: Anthropic.Tool[] = []

    Array.from(this.servers.entries()).forEach(([serverName, server]) => {
      for (const tool of server.tools) {
        tools.push({
          name: `mcp_${serverName}_${tool.name}`,
          description: tool.description || `MCP tool: ${tool.name} from ${serverName}`,
          input_schema: tool.inputSchema as Anthropic.Tool['input_schema']
        })
      }
    })

    return tools
  }

  /**
   * Check if a tool name is an MCP tool
   */
  isMcpTool(name: string): boolean {
    return name.startsWith('mcp_')
  }

  /**
   * Execute an MCP tool
   */
  async executeTool(
    toolName: string,
    input: unknown
  ): Promise<{ success: boolean; data?: unknown; error?: string }> {
    // Parse tool name: mcp_<serverName>_<toolName>
    const parts = toolName.split('_')
    if (parts.length < 3 || parts[0] !== 'mcp') {
      return { success: false, error: 'Invalid MCP tool name' }
    }

    const serverName = parts[1]
    const actualToolName = parts.slice(2).join('_')

    const server = this.servers.get(serverName)
    if (!server) {
      return { success: false, error: `MCP server ${serverName} not connected` }
    }

    try {
      console.log(`[MCP:${serverName}] Executing tool: ${actualToolName}`)
      const result = await this.sendRequest(server, 'tools/call', {
        name: actualToolName,
        arguments: input
      })

      // Handle MCP tool result format
      const mcpResult = result as { content?: Array<{ type: string; text?: string; data?: string; mimeType?: string }> }
      
      if (mcpResult.content && Array.isArray(mcpResult.content)) {
        // Extract text content or return full result
        const textContent = mcpResult.content.find(c => c.type === 'text')
        if (textContent && textContent.text) {
          return { success: true, data: textContent.text }
        }
        
        // Check for image content
        const imageContent = mcpResult.content.find(c => c.type === 'image')
        if (imageContent && imageContent.data) {
          return { 
            success: true, 
            data: {
              type: 'image',
              mimeType: imageContent.mimeType || 'image/png',
              data: imageContent.data
            }
          }
        }
      }

      return { success: true, data: result }
    } catch (error) {
      console.error(`[MCP:${serverName}] Tool execution failed:`, error)
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  /**
   * Reload MCP configuration and reconnect servers
   */
  async reload(): Promise<void> {
    console.log('[MCP] Reloading configuration...')
    
    // Disconnect all existing servers
    await this.shutdown()
    
    // Reset state
    this.initialized = false
    
    // Reinitialize
    await this.initialize()
  }

  /**
   * Shutdown all MCP servers
   */
  async shutdown(): Promise<void> {
    console.log('[MCP] Shutting down all servers...')
    
    Array.from(this.servers.entries()).forEach(([name, server]) => {
      try {
        server.process.kill()
        console.log(`[MCP:${name}] Server stopped`)
      } catch (error) {
        console.error(`[MCP:${name}] Failed to stop server:`, error)
      }
    })
    
    this.servers.clear()
  }

  /**
   * Get connected server count
   */
  getServerCount(): number {
    return this.servers.size
  }

  /**
   * Get server status
   */
  getServerStatus(): Array<{ name: string; toolCount: number; connected: boolean }> {
    const status: Array<{ name: string; toolCount: number; connected: boolean }> = []
    
    Array.from(this.servers.entries()).forEach(([name, server]) => {
      status.push({
        name,
        toolCount: server.tools.length,
        connected: !server.process.killed
      })
    })
    
    return status
  }
}

// Export singleton instance
export const mcpService = new McpService()
