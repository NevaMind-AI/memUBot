/**
 * AutoConnect Service
 * Exports the appropriate implementation based on APP_MODE
 */
import type { IAutoConnectService, AppMode } from './types'
import { memuAutoConnectService } from './memu.impl'
import { yumiAutoConnectService } from './yumi.impl'

/**
 * Get the current app mode from environment variable
 * APP_MODE is set in npm scripts (e.g., APP_MODE=yumi npm run dev:yumi)
 */
function getAppMode(): AppMode {
  const mode = process.env.APP_MODE || 'memu'
  console.log('[AutoConnect] App mode:', mode)
  return mode as AppMode
}

/**
 * Get the appropriate AutoConnect service based on app mode
 */
function getAutoConnectService(): IAutoConnectService {
  const mode = getAppMode()
  
  switch (mode) {
    case 'yumi':
      return yumiAutoConnectService
    case 'memu':
    default:
      return memuAutoConnectService
  }
}

// Export the service instance based on current mode
export const autoConnectService = getAutoConnectService()

// Re-export types
export type { IAutoConnectService, AppMode } from './types'
