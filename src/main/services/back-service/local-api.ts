/**
 * Local API Service
 *
 * Exposes LLM capabilities through a local HTTP API endpoint.
 * Only accessible from localhost (127.0.0.1).
 */

import http from 'http'
import { URL } from 'url'
import { agentService } from '../agent.service'
import { invokeService } from './invoke'
import { LOCAL_API_PORT } from './constants'
import type { InvokeRequest } from './types'

/** API Response structure */
interface ApiResponse {
  success: boolean
  data?: unknown
  error?: string
}

class LocalApiService {
  private server: http.Server | null = null
  private isRunning = false

  getPort(): number {
    return LOCAL_API_PORT
  }

  getBaseUrl(): string {
    return `http://127.0.0.1:${LOCAL_API_PORT}`
  }

  isServerRunning(): boolean {
    return this.isRunning
  }

  async start(): Promise<boolean> {
    if (this.isRunning) {
      console.log('[LocalAPI] Server already running')
      return true
    }

    return new Promise((resolve) => {
      this.server = http.createServer((req, res) => {
        this.handleRequest(req, res)
      })

      this.server.listen(LOCAL_API_PORT, '127.0.0.1', () => {
        this.isRunning = true
        console.log(`[LocalAPI] Server started at http://127.0.0.1:${LOCAL_API_PORT}`)
        resolve(true)
      })

      this.server.on('error', (error: NodeJS.ErrnoException) => {
        console.error('[LocalAPI] Server error:', error)
        this.isRunning = false
        resolve(false)
      })
    })
  }

  async stop(): Promise<void> {
    if (!this.server || !this.isRunning) return

    return new Promise((resolve) => {
      this.server!.close(() => {
        this.isRunning = false
        this.server = null
        console.log('[LocalAPI] Server stopped')
        resolve()
      })
    })
  }

  private handleRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    res.setHeader('Content-Type', 'application/json')

    if (req.method === 'OPTIONS') {
      res.writeHead(204)
      res.end()
      return
    }

    const url = new URL(req.url || '/', `http://127.0.0.1:${LOCAL_API_PORT}`)
    console.log(`[LocalAPI] ${req.method} ${url.pathname}`)
    this.routeRequest(req, res, url.pathname)
  }

  private routeRequest(req: http.IncomingMessage, res: http.ServerResponse, pathname: string): void {
    if (pathname === '/api/health' && req.method === 'GET') {
      return this.handleHealth(res)
    }
    if (pathname === '/api/v1/status' && req.method === 'GET') {
      return this.handleStatus(res)
    }
    if (pathname === '/api/v1/invoke' && req.method === 'POST') {
      return this.handleInvoke(req, res)
    }

    this.sendResponse(res, 404, { success: false, error: `Endpoint not found: ${pathname}` })
  }

  private handleHealth(res: http.ServerResponse): void {
    this.sendResponse(res, 200, {
      success: true,
      data: { status: 'healthy', version: '1.0.0', timestamp: new Date().toISOString() }
    })
  }

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

  private handleInvoke(req: http.IncomingMessage, res: http.ServerResponse): void {
    let body = ''
    req.on('data', (chunk) => { body += chunk.toString() })

    req.on('end', async () => {
      try {
        const payload = JSON.parse(body)
        const validation = invokeService.validateRequest(payload)
        if (!validation.valid) {
          this.sendResponse(res, 400, { success: false, error: validation.error })
          return
        }

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
      this.sendResponse(res, 500, { success: false, error: 'Request error' })
    })
  }

  private sendResponse(res: http.ServerResponse, statusCode: number, body: ApiResponse): void {
    res.writeHead(statusCode)
    res.end(JSON.stringify(body))
  }
}

/** Singleton instance */
export const localApiService = new LocalApiService()
