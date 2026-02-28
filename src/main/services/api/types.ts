/**
 * API Types
 * 
 * Data structures for Memu API requests and responses.
 */

// ============================================
// Base Types
// ============================================

export interface ApiResponse<T> {
  status: 'ok' | 'error'
  message: string
  data?: T
  meta?: Record<string, unknown>
  error_code?: string
  details?: unknown[]
}

// ============================================
// Auth Types
// ============================================

export interface CsrfTokenResponse {
  csrf_token: string
}

// ============================================
// Config Types
// ============================================

export interface MemuApiConfig {
  baseUrl: string
}
