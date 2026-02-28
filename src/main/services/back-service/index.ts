/**
 * Back-service module
 *
 * Re-exports all public APIs for backward compatibility.
 */

// Manager (service lifecycle)
export { serviceManager } from './manager'

// Local API server
export { localApiService } from './local-api'

// Invoke service
export { invokeService } from './invoke'

// Types
export type {
  ServiceType,
  ServiceRuntime,
  ServiceStatus,
  ServiceMetadata,
  ServiceInfo,
  ServiceHealthMetrics,
  InvokeContext,
  InvokeData,
  InvokeRequest,
  InvokeAction,
  InvokeResult,
  DryRunResult
} from './types'

// Logger (for direct access if needed)
export * as serviceLogger from './logger'

// Constants
export {
  LOCAL_API_PORT,
  LOCAL_API_BASE_URL
} from './constants'
