/**
 * Power Service - Prevents system from entering sleep mode
 *
 * Uses Electron's powerSaveBlocker to keep the system active while the app is running.
 * This is useful for long-running tasks like agent processing, downloads, etc.
 */
import { powerSaveBlocker } from 'electron'

type BlockerType = 'prevent-app-suspension' | 'prevent-display-sleep'

class PowerService {
  private blockerId: number | null = null

  /**
   * Start blocking system sleep
   * @param type 'prevent-app-suspension' keeps system active but allows screen off
   *             'prevent-display-sleep' keeps both system and screen active
   */
  start(type: BlockerType = 'prevent-app-suspension'): void {
    if (this.blockerId !== null) {
      console.log('[PowerService] Already blocking sleep')
      return
    }

    this.blockerId = powerSaveBlocker.start(type)
    console.log(`[PowerService] Started blocking sleep (id: ${this.blockerId}, type: ${type})`)
  }

  /**
   * Stop blocking system sleep
   */
  stop(): void {
    if (this.blockerId === null) {
      return
    }

    powerSaveBlocker.stop(this.blockerId)
    console.log(`[PowerService] Stopped blocking sleep (id: ${this.blockerId})`)
    this.blockerId = null
  }

  /**
   * Check if currently blocking sleep
   */
  isBlocking(): boolean {
    return this.blockerId !== null && powerSaveBlocker.isStarted(this.blockerId)
  }
}

export const powerService = new PowerService()
