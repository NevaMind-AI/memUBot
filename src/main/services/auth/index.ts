/**
 * Auth Service - Mode-specific authentication
 *
 * Yumi: Firebase authentication with backend token exchange
 * Memu: No authentication (no-op implementation)
 */

import { IAuthService } from './types'
import { MemuAuthService } from './memu.impl'
import { YumiAuthService } from './yumi.impl'

export * from './types'

function getAppMode(): 'memu' | 'yumi' {
  const modeFromVite = import.meta.env?.MAIN_VITE_APP_MODE
  const modeFromProcess = process.env.APP_MODE
  return (modeFromVite || modeFromProcess || 'memu') as 'memu' | 'yumi'
}

let authServiceInstance: IAuthService | null = null

export function getAuthService(): IAuthService {
  if (!authServiceInstance) {
    const appMode = getAppMode()
    if (appMode === 'yumi') {
      console.log('[Auth] Creating Yumi auth service')
      authServiceInstance = new YumiAuthService()
    } else {
      console.log('[Auth] Creating Memu auth service (no-op)')
      authServiceInstance = new MemuAuthService()
    }
  }
  return authServiceInstance
}

export type { IAuthService }
