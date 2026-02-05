/**
 * Analytics Service for Renderer Process
 * Uses Grafana Faro Web SDK
 */

import { initializeFaro, faro, getWebInstrumentations } from '@grafana/faro-web-sdk'
import { TracingInstrumentation } from '@grafana/faro-web-tracing'
import { LogLevel } from '@grafana/faro-core'

// Faro configuration
const FARO_CONFIG = {
  url: 'https://faro-collector-prod-ap-northeast-0.grafana.net/collect/87842c112359975bd36c32e7c4469ff0',
  appName: 'memU-bot',
  appVersion: '1.0.0'
}

let initialized = false

// Declare window.analytics type
declare global {
  interface Window {
    analytics?: {
      getConfig: () => Promise<{
        userId: string
        attributes: Record<string, string>
      }>
      onTrack: (callback: (data: { eventName: string; attributes?: Record<string, string> }) => void) => () => void
      onSetUser: (callback: (data: { userId: string; attributes?: Record<string, string> }) => void) => () => void
    }
  }
}

/**
 * Initialize Faro SDK and setup listeners
 */
export async function initializeAnalytics(): Promise<void> {
  if (initialized) return

  try {
    // Initialize Faro SDK
    initializeFaro({
      url: FARO_CONFIG.url,
      app: {
        name: FARO_CONFIG.appName,
        version: FARO_CONFIG.appVersion,
        environment: import.meta.env.PROD ? 'production' : 'development'
      },
      instrumentations: [
        // Default web instrumentations (required)
        ...getWebInstrumentations(),
        // Tracing for HTTP requests
        new TracingInstrumentation()
      ]
    })

    initialized = true
    console.log('[Analytics] Faro SDK initialized')

    // Get initial config from main process and set user
    if (window.analytics) {
      const config = await window.analytics.getConfig()
      if (config && config.userId) {
        setUser(config.userId, config.attributes)
      }

      // Setup listeners for events from main process
      setupMainProcessListener()
    }
  } catch (error) {
    console.error('[Analytics] Failed to initialize Faro SDK:', error)
  }
}

/**
 * Track an event
 */
export function trackEvent(
  eventName: string,
  attributes?: Record<string, string>
): void {
  if (!initialized || !faro.api) return

  try {
    faro.api.pushEvent(eventName, attributes)
    console.log('[Analytics] Event tracked:', eventName)
  } catch (error) {
    console.error('[Analytics] Failed to track event:', error)
  }
}

/**
 * Set user information
 */
export function setUser(userId: string, attributes?: Record<string, string>): void {
  if (!initialized || !faro.api) return

  try {
    faro.api.setUser({
      id: userId,
      attributes
    })
    console.log('[Analytics] User set:', userId)
  } catch (error) {
    console.error('[Analytics] Failed to set user:', error)
  }
}

/**
 * Push a log message
 */
export function pushLog(message: string, level: 'info' | 'warn' | 'error' = 'info'): void {
  if (!initialized || !faro.api) return

  try {
    faro.api.pushLog([message], { level: level as LogLevel })
  } catch (error) {
    console.error('[Analytics] Failed to push log:', error)
  }
}

/**
 * Setup listener for events from main process
 */
function setupMainProcessListener(): void {
  if (!window.analytics) return

  // Listen for tracking events from main process
  window.analytics.onTrack((data) => {
    trackEvent(data.eventName, data.attributes)
  })

  // Listen for user info updates
  window.analytics.onSetUser((data) => {
    setUser(data.userId, data.attributes)
  })

  console.log('[Analytics] Main process listener setup')
}
