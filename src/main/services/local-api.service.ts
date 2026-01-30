import http from 'http'
import { URL } from 'url'
import { agentService } from './agent.service'
import { invokeService, type InvokeRequest } from './invoke.service'

/**
 * Local API Service
 * Exposes LLM capabilities through a local HTTP API endpoint
 * Only accessible from localhost (127.0.0.1)
 */

// Port number: 31415 (π digits - memorable and unlikely to conflict)
const LOCAL_API_PORT = 31415

/**
 * API Response structure
 */
interface ApiResponse {
  success: boolean
  data?: unknown
  error?: string
}

/**
 * Local API Service class
 */
class LocalApiService {
  private server: http.Server | null = null
  private isRunning = false

  /**
   * Get the API port number
   */
  getPort(): number {
    return LOCAL_API_PORT
  }

  /**
   * Get the base URL for the API
   */
  getBaseUrl(): string {
    return `http://127.0.0.1:${LOCAL_API_PORT}`
  }

  /**
   * Check if the API server is running
   */
  isServerRunning(): boolean {
    return this.isRunning
  }

  /**
   * Start the local API server
   */
  async start(): Promise<boolean> {
    if (this.isRunning) {
      console.log('[LocalAPI] Server already running')
      return true
    }

    return new Promise((resolve) => {
      this.server = http.createServer((req, res) => {
        this.handleRequest(req, res)
      })

      // Only listen on localhost for security
      this.server.listen(LOCAL_API_PORT, '127.0.0.1', () => {
        this.isRunning = true
        console.log(`[LocalAPI] Server started at http://127.0.0.1:${LOCAL_API_PORT}`)
        resolve(true)
      })

      this.server.on('error', (error: NodeJS.ErrnoException) => {
        console.error('[LocalAPI] Server error:', error)
        if (error.code === 'EADDRINUSE') {
          console.error(`[LocalAPI] Port ${LOCAL_API_PORT} is already in use`)
        }
        this.isRunning = false
        resolve(false)
      })
    })
  }

  /**
   * Stop the local API server
   */
  async stop(): Promise<void> {
    if (!this.server || !this.isRunning) {
      return
    }

    return new Promise((resolve) => {
      this.server!.close(() => {
        this.isRunning = false
        this.server = null
        console.log('[LocalAPI] Server stopped')
        resolve()
      })
    })
  }

  /**
   * Handle incoming HTTP requests
   */
  private handleRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
    // Set CORS headers for local development
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    res.setHeader('Content-Type', 'application/json')

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      res.writeHead(204)
      res.end()
      return
    }

    const url = new URL(req.url || '/', `http://127.0.0.1:${LOCAL_API_PORT}`)
    const pathname = url.pathname

    console.log(`[LocalAPI] ${req.method} ${pathname}`)

    // Route requests to appropriate handlers
    this.routeRequest(req, res, pathname)
  }

  /**
   * Route request to appropriate endpoint handler
   */
  private routeRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    pathname: string
  ): void {
    // Health check endpoint
    if (pathname === '/api/health' && req.method === 'GET') {
      this.handleHealth(res)
      return
    }

    // API v1 endpoints
    if (pathname === '/api/v1/status' && req.method === 'GET') {
      this.handleStatus(res)
      return
    }

    if (pathname === '/api/v1/invoke' && req.method === 'POST') {
      this.handleInvoke(req, res)
      return
    }

    // 404 Not Found
    this.sendResponse(res, 404, {
      success: false,
      error: `Endpoint not found: ${pathname}`
    })
  }

  /**
   * GET /api/health - Health check endpoint
   */
  private handleHealth(res: http.ServerResponse): void {
    this.sendResponse(res, 200, {
      success: true,
      data: {
        status: 'healthy',
        version: '1.0.0',
        timestamp: new Date().toISOString()
      }
    })
  }

  /**
   * GET /api/v1/status - Get LLM status
   */
  private handleStatus(res: http.ServerResponse): void {
    const status = agentService.getStatus()
    const currentPlatform = agentService.getCurrentPlatform()
    const recentReplyPlatform = agentService.getRecentReplyPlatform()

    this.sendResponse(res, 200, {
      success: true,
      data: {
        llmStatus: status.status,
        currentTool: status.currentTool,
        iteration: status.iteration,
        currentPlatform,
        recentReplyPlatform
      }
    })
  }

  /**
   * POST /api/v1/invoke - Invoke LLM with context and data for evaluation
   */
  private handleInvoke(req: http.IncomingMessage, res: http.ServerResponse): void {
    let body = ''

    req.on('data', (chunk) => {
      body += chunk.toString()
    })

    req.on('end', async () => {
      try {
        const payload = JSON.parse(body)

        // Validate request payload
        const validation = invokeService.validateRequest(payload)
        if (!validation.valid) {
          this.sendResponse(res, 400, {
            success: false,
            error: validation.error
          })
          return
        }

        // Process the invoke request
        const result = await invokeService.process(payload as InvokeRequest)

        this.sendResponse(res, result.success ? 200 : 500, {
          success: result.success,
          data: {
            action: result.action,
            reason: result.reason,
            notificationSent: result.notificationSent,
            platform: result.platform,
            message: result.message
          },
          error: result.error
        })
      } catch (error) {
        console.error('[LocalAPI] Invoke error:', error)
        this.sendResponse(res, 400, {
          success: false,
          error: error instanceof SyntaxError ? 'Invalid JSON payload' : String(error)
        })
      }
    })

    req.on('error', () => {
      this.sendResponse(res, 500, {
        success: false,
        error: 'Request error'
      })
    })
  }

  /**
   * Send JSON response
   */
  private sendResponse(res: http.ServerResponse, statusCode: number, body: ApiResponse): void {
    res.writeHead(statusCode)
    res.end(JSON.stringify(body))
  }
}

// Export singleton instance
export const localApiService = new LocalApiService()
