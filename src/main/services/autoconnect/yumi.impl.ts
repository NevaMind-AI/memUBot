/**
 * AutoConnect Service - Yumi Implementation
 * Yumi is a self-hosted platform, no external messaging platforms to connect
 */
import type { IAutoConnectService } from './types'

class YumiAutoConnectService implements IAutoConnectService {
  /**
   * Connect to configured platforms
   * Yumi doesn't connect to external messaging platforms
   */
  async connectConfiguredPlatforms(): Promise<void> {
    console.log('[AutoConnect:Yumi] Yumi mode - no external platforms to connect')
    // TODO: Add Yumi-specific connection logic if needed in the future
  }
}

// Export singleton instance
export const yumiAutoConnectService = new YumiAutoConnectService()
