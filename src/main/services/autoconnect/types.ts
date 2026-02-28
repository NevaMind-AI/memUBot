/**
 * AutoConnect Service Interface
 * Defines the contract for auto-connecting to platforms on app startup
 */
export interface IAutoConnectService {
  /**
   * Connect to all configured platforms
   * Called during app startup
   */
  connectConfiguredPlatforms(): Promise<void>
}
