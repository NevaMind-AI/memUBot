/**
 * AutoConnect Service
 * Connects configured messaging platforms on app startup
 */
import type { IAutoConnectService } from './types'
import { memuAutoConnectService } from './memu.impl'

// Export the service instance
export const autoConnectService: IAutoConnectService = memuAutoConnectService

// Re-export types
export type { IAutoConnectService } from './types'
