/**
 * AutoConnect Service
 * Connects configured messaging platforms on app startup
 */
import type { IAutoConnectService } from './types'
import { autoConnectService2501 } from './2501.impl'

// Export the service instance
export const autoConnectService: IAutoConnectService = autoConnectService2501

// Re-export types
export type { IAutoConnectService } from './types'
