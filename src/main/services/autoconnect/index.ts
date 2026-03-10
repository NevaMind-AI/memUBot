/**
 * AutoConnect Service
 * Connects configured messaging platforms on app startup
 */
import type { IAutoConnectService } from './types'
import { 2501AutoConnectService } from './2501.impl'

// Export the service instance
export const autoConnectService: IAutoConnectService = 2501AutoConnectService

// Re-export types
export type { IAutoConnectService } from './types'
