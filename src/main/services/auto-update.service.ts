import { app, dialog, BrowserWindow } from 'electron'
import { autoUpdater, UpdateInfo } from 'electron-updater'
import { is } from '@electron-toolkit/utils'

/**
 * AutoUpdateService - Handles checking, downloading, and installing app updates.
 *
 * Uses electron-updater with a generic (S3/CloudFront) provider.
 * Update metadata files (latest-mac.yml / latest.yml) are hosted alongside
 * the installers on CloudFront.
 *
 * Flow:
 *   1. checkForUpdates() is called after startup
 *   2. If a new version is found, a dialog asks the user to confirm download
 *   3. After download completes, a dialog asks to restart and install
 */
class AutoUpdateService {
  private initialized = false
  private checking = false

  /**
   * Initialize the updater event listeners.
   * Safe to call multiple times — only initializes once.
   */
  initialize(): void {
    if (this.initialized) return
    this.initialized = true

    // Do not auto-download; let user confirm first
    autoUpdater.autoDownload = false
    autoUpdater.autoInstallOnAppQuit = true

    // Logging
    autoUpdater.logger = {
      info: (msg: string) => console.log(`[AutoUpdate] ${msg}`),
      warn: (msg: string) => console.warn(`[AutoUpdate] ${msg}`),
      error: (msg: string) => console.error(`[AutoUpdate] ${msg}`),
      debug: (msg: string) => console.log(`[AutoUpdate:debug] ${msg}`)
    } as unknown as typeof autoUpdater.logger

    this.registerEventHandlers()
    console.log('[AutoUpdate] Service initialized')
  }

  /**
   * Register all autoUpdater event handlers
   */
  private registerEventHandlers(): void {
    autoUpdater.on('checking-for-update', () => {
      console.log('[AutoUpdate] Checking for update...')
    })

    autoUpdater.on('update-available', (info: UpdateInfo) => {
      console.log(`[AutoUpdate] Update available: v${info.version}`)
      this.promptForDownload(info)
    })

    autoUpdater.on('update-not-available', (info: UpdateInfo) => {
      console.log(`[AutoUpdate] Already up to date: v${info.version}`)
    })

    autoUpdater.on('download-progress', (progress) => {
      const percent = Math.round(progress.percent)
      console.log(`[AutoUpdate] Download progress: ${percent}%`)

      // Forward progress to renderer
      const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
      if (win && !win.isDestroyed()) {
        win.webContents.send('updater:download-progress', {
          percent,
          bytesPerSecond: progress.bytesPerSecond,
          transferred: progress.transferred,
          total: progress.total
        })
      }
    })

    autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
      console.log(`[AutoUpdate] Update downloaded: v${info.version}`)
      this.promptForInstall(info)
    })

    autoUpdater.on('error', (err: Error) => {
      console.error('[AutoUpdate] Error:', err.message)
      this.checking = false
    })
  }

  /**
   * Show dialog asking user whether to download the new version
   */
  private async promptForDownload(info: UpdateInfo): Promise<void> {
    const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]

    const result = await dialog.showMessageBox(win ?? ({} as BrowserWindow), {
      type: 'info',
      title: 'Update Available',
      message: `A new version (v${info.version}) is available.`,
      detail: 'Would you like to download and install it now?',
      buttons: ['Update Now', 'Later'],
      defaultId: 0,
      cancelId: 1
    })

    if (result.response === 0) {
      console.log('[AutoUpdate] User confirmed download')
      autoUpdater.downloadUpdate()
    } else {
      console.log('[AutoUpdate] User deferred update')
      this.checking = false
    }
  }

  /**
   * Show dialog asking user whether to restart and install
   */
  private async promptForInstall(info: UpdateInfo): Promise<void> {
    const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]

    const result = await dialog.showMessageBox(win ?? ({} as BrowserWindow), {
      type: 'info',
      title: 'Update Ready',
      message: `Version v${info.version} has been downloaded.`,
      detail: 'Restart the application to apply the update.',
      buttons: ['Restart Now', 'Later'],
      defaultId: 0,
      cancelId: 1
    })

    this.checking = false

    if (result.response === 0) {
      console.log('[AutoUpdate] User confirmed restart')
      autoUpdater.quitAndInstall()
    } else {
      console.log('[AutoUpdate] User will restart later')
    }
  }

  /**
   * Check for updates.
   * In development, this is a no-op unless a dev-app-update.yml is present.
   * Returns true if the check was initiated, false if skipped.
   */
  async checkForUpdates(): Promise<boolean> {
    if (this.checking) {
      console.log('[AutoUpdate] Already checking, skipping')
      return false
    }

    // In development, electron-updater looks for dev-app-update.yml
    // but we skip the check by default to avoid noise during dev
    if (is.dev) {
      console.log('[AutoUpdate] Skipping update check in development')
      return false
    }

    this.checking = true

    try {
      await autoUpdater.checkForUpdates()
      return true
    } catch (err) {
      console.error('[AutoUpdate] Check failed:', err instanceof Error ? err.message : err)
      this.checking = false
      return false
    }
  }

  /**
   * Manually check for updates (from user action).
   * Shows a "no update" dialog if already up to date.
   */
  async checkForUpdatesManual(): Promise<void> {
    if (this.checking) return

    this.checking = true

    // Temporarily listen for "no update" to inform user
    const onNoUpdate = (info: UpdateInfo): void => {
      const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
      dialog.showMessageBox(win ?? ({} as BrowserWindow), {
        type: 'info',
        title: 'No Update Available',
        message: `You are using the latest version (v${info.version}).`,
        buttons: ['OK']
      })
      this.checking = false
    }

    const onError = (err: Error): void => {
      const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
      dialog.showMessageBox(win ?? ({} as BrowserWindow), {
        type: 'error',
        title: 'Update Check Failed',
        message: 'Could not check for updates.',
        detail: err.message,
        buttons: ['OK']
      })
      this.checking = false
    }

    autoUpdater.once('update-not-available', onNoUpdate)
    autoUpdater.once('error', onError)

    try {
      await autoUpdater.checkForUpdates()
    } catch (err) {
      console.error('[AutoUpdate] Manual check failed:', err instanceof Error ? err.message : err)
      this.checking = false
    } finally {
      // Clean up one-time listeners after a timeout to avoid leaks
      setTimeout(() => {
        autoUpdater.removeListener('update-not-available', onNoUpdate)
        autoUpdater.removeListener('error', onError)
      }, 30_000)
    }
  }

  /**
   * Get current app version
   */
  getVersion(): string {
    return app.getVersion()
  }
}

export const autoUpdateService = new AutoUpdateService()
