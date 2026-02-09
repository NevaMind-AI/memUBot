/**
 * Memu API Client
 * 
 * Base HTTP client with CSRF token management.
 */

import type { ApiResponse, CsrfTokenResponse, MemuApiConfig } from './types'

// ============================================
// Error Class
// ============================================

export class MemuApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly errorCode?: string,
    public readonly details?: unknown[]
  ) {
    super(message)
    this.name = 'MemuApiError'
  }
}

// ============================================
// API Client
// ============================================

export class MemuApiClient {
  private baseUrl: string
  private csrfToken: string | null = null

  constructor(config: MemuApiConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '') // Remove trailing slash
  }

  /**
   * Get the base URL
   */
  getBaseUrl(): string {
    return this.baseUrl
  }

  /**
   * Fetch CSRF token from the server
   * Must be called before making authenticated requests
   */
  async fetchCsrfToken(): Promise<string> {
    console.log('[MemuAPI] Fetching CSRF token...')
    
    const response = await fetch(`${this.baseUrl}/api/v3/auth/csrf`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch CSRF token: ${response.status} ${response.statusText}`)
    }

    const data = await response.json() as ApiResponse<CsrfTokenResponse> | CsrfTokenResponse
    
    // Handle both wrapped and direct response formats
    const csrfToken = 'data' in data && data.data?.csrf_token 
      ? data.data.csrf_token 
      : (data as CsrfTokenResponse).csrf_token

    if (!csrfToken) {
      throw new Error('CSRF token not found in response')
    }

    this.csrfToken = csrfToken
    console.log('[MemuAPI] CSRF token obtained')
    return csrfToken
  }

  /**
   * Ensure we have a valid CSRF token
   */
  private async ensureCsrfToken(): Promise<string> {
    if (!this.csrfToken) {
      return await this.fetchCsrfToken()
    }
    return this.csrfToken
  }

  /**
   * Make an API request
   */
  async request<T>(
    endpoint: string,
    options: {
      method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
      headers?: Record<string, string>
      body?: unknown
      requiresCsrf?: boolean
    } = {}
  ): Promise<ApiResponse<T>> {
    const { method = 'GET', headers = {}, body, requiresCsrf = true } = options

    // Ensure CSRF token if required
    if (requiresCsrf) {
      await this.ensureCsrfToken()
    }

    const requestHeaders: Record<string, string> = {
      'Accept': 'application/json',
      ...headers
    }

    // Add CSRF token to headers and cookies
    if (requiresCsrf && this.csrfToken) {
      requestHeaders['X-CSRF-Token'] = this.csrfToken
      requestHeaders['Cookie'] = `memu_csrf_token=${this.csrfToken}`
    }

    // Add content type for requests with body
    if (body) {
      requestHeaders['Content-Type'] = 'application/json'
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method,
      headers: requestHeaders,
      body: body ? JSON.stringify(body) : undefined
    })

    const data = await response.json() as ApiResponse<T>

    if (!response.ok || data.status === 'error') {
      const errorMessage = data.message || `Request failed: ${response.status}`
      console.error(`[MemuAPI] Error: ${errorMessage}`, data)
      throw new MemuApiError(errorMessage, response.status, data.error_code, data.details)
    }

    return data
  }

  /**
   * Clear cached CSRF token (call on logout)
   */
  clearSession(): void {
    this.csrfToken = null
  }
}

// ============================================
// Default Instance
// ============================================

export const DEFAULT_BASE_URL = 'https://api.memu.so'

let defaultClient: MemuApiClient | null = null

export function getMemuApiClient(): MemuApiClient {
  if (!defaultClient) {
    defaultClient = new MemuApiClient({
      baseUrl: DEFAULT_BASE_URL
    })
  }
  return defaultClient
}

export function createMemuApiClient(config: MemuApiConfig): MemuApiClient {
  return new MemuApiClient(config)
}
