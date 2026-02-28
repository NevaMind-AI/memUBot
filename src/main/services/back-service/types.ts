/**
 * Back-service shared types
 */

// ============================================
// Service Metadata & Info
// ============================================

/** Service type */
export type ServiceType = 'longRunning' | 'scheduled'

/** Service runtime */
export type ServiceRuntime = 'node' | 'python'

/** Service status */
export type ServiceStatus = 'stopped' | 'running' | 'error'

/** Service metadata stored in service.json */
export interface ServiceMetadata {
  id: string
  name: string
  description: string
  type: ServiceType
  runtime: ServiceRuntime
  entryFile: string
  schedule?: string
  createdAt: string
  enabled?: boolean
  context: {
    userRequest: string
    expectation: string
    notifyPlatform?: string
  }
}

/** Service health metrics */
export interface ServiceHealthMetrics {
  /** Last time any stdout output was received */
  lastActivityAt: string | null
  /** Last time invoke API was called */
  lastInvokeAt: string | null
  /** Total error count since last start */
  errorCount: number
  /** Total restart count (crash recovery) */
  restartCount: number
  /** Whether the service passed startup health check */
  startupHealthy: boolean
}

/** Service info with runtime status */
export interface ServiceInfo extends ServiceMetadata {
  status: ServiceStatus
  pid?: number
  error?: string
  lastStarted?: string
  lastStopped?: string
  health?: ServiceHealthMetrics
}

// ============================================
// Invoke Types
// ============================================

/** Invoke request context - user's original request/expectation */
export interface InvokeContext {
  userRequest: string
  expectation: string
  notifyPlatform?: string
}

/** Invoke request data - information gathered by the monitoring service */
export interface InvokeData {
  summary: string
  details?: string
  timestamp: string
  metadata?: Record<string, unknown>
}

/** Invoke request payload */
export interface InvokeRequest {
  context: InvokeContext
  data: InvokeData
  serviceId?: string
}

/** Invoke response action */
export type InvokeAction = 'notified' | 'ignored' | 'error' | 'rate_limited'

/** Invoke result */
export interface InvokeResult {
  success: boolean
  action: InvokeAction
  reason: string
  notificationSent: boolean
  platform?: string
  message?: string
  error?: string
}

// ============================================
// Dry Run Types
// ============================================

/** Dry run result */
export interface DryRunResult {
  success: boolean
  stdout: string
  stderr: string
  exitCode: number | null
  timedOut: boolean
  error?: string
}
