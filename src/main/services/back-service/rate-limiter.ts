/**
 * Rate limiter for invoke API calls
 *
 * Tracks call timestamps per serviceId and enforces a max-calls-per-window limit.
 * Prevents buggy services from spamming the LLM evaluation endpoint.
 */

import { INVOKE_RATE_LIMIT_PER_MINUTE, RATE_LIMIT_WINDOW_MS } from './constants'

/** Per-service call timestamp history */
const callHistory = new Map<string, number[]>()

/**
 * Check if a service is allowed to make an invoke call.
 * @returns true if allowed, false if rate-limited
 */
export function isAllowed(serviceId: string): boolean {
  const now = Date.now()
  const windowStart = now - RATE_LIMIT_WINDOW_MS

  // Get or create history for this service
  let history = callHistory.get(serviceId)
  if (!history) {
    history = []
    callHistory.set(serviceId, history)
  }

  // Remove timestamps outside the window
  const filtered = history.filter((ts) => ts > windowStart)
  callHistory.set(serviceId, filtered)

  return filtered.length < INVOKE_RATE_LIMIT_PER_MINUTE
}

/**
 * Record a call for rate limiting purposes.
 */
export function recordCall(serviceId: string): void {
  const history = callHistory.get(serviceId) || []
  history.push(Date.now())
  callHistory.set(serviceId, history)
}

/**
 * Get remaining calls for a service in the current window.
 */
export function getRemainingCalls(serviceId: string): number {
  const now = Date.now()
  const windowStart = now - RATE_LIMIT_WINDOW_MS
  const history = callHistory.get(serviceId) || []
  const recentCount = history.filter((ts) => ts > windowStart).length
  return Math.max(0, INVOKE_RATE_LIMIT_PER_MINUTE - recentCount)
}

/**
 * Clear all rate limit history (for testing or reset).
 */
export function clearAll(): void {
  callHistory.clear()
}
