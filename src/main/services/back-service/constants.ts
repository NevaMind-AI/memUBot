/**
 * Back-service constants
 */

/** Local API port (pi digits - memorable and unlikely to conflict) */
export const LOCAL_API_PORT = 31415

/** Local API base URL */
export const LOCAL_API_BASE_URL = `http://127.0.0.1:${LOCAL_API_PORT}`

/** Invoke API endpoint */
export const INVOKE_ENDPOINT = '/api/v1/invoke'

// ============================================
// Crash Recovery
// ============================================

/** Max restart attempts before marking service as 'error' */
export const MAX_RESTART_ATTEMPTS = 5

/** Restart attempts window in ms (reset counter after this) */
export const RESTART_WINDOW_MS = 60 * 60 * 1000 // 1 hour

/** Backoff delays for restart (in ms): 5s, 10s, 30s, 60s, 60s */
export const RESTART_BACKOFF_MS = [5000, 10000, 30000, 60000, 60000]

// ============================================
// Rate Limiting
// ============================================

/** Max invoke calls per service per minute */
export const INVOKE_RATE_LIMIT_PER_MINUTE = 5

/** Rate limit window in ms */
export const RATE_LIMIT_WINDOW_MS = 60 * 1000

// ============================================
// Invoke Retry
// ============================================

/** Max retry attempts for failed invoke evaluations */
export const INVOKE_MAX_RETRIES = 3

/** Retry delay in ms */
export const INVOKE_RETRY_DELAY_MS = 5000

// ============================================
// Process Management
// ============================================

/** Timeout for startup health check (wait for first output) */
export const STARTUP_HEALTH_CHECK_MS = 5000

/** Timeout for graceful shutdown (SIGTERM) before SIGKILL */
export const GRACEFUL_SHUTDOWN_MS = 5000

/** Default dry-run timeout */
export const DRY_RUN_TIMEOUT_MS = 30000

// ============================================
// Logging
// ============================================

/** Max log file size in bytes (1MB) */
export const MAX_LOG_FILE_SIZE = 1 * 1024 * 1024

/** Log file name */
export const SERVICE_LOG_FILE = 'service.log'
