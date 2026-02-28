/**
 * App initialization - MUST be imported first before any other modules
 * 
 * This sets up the app name and userData path based on MAIN_VITE_APP_MODE.
 * 
 * Why this is needed:
 * - package.json has "name": "memu-bot" which Electron uses as default app.name
 * - Many services are instantiated at module load time (singleton pattern)
 * - These services call app.getPath('userData') in their constructors
 * - Without this early initialization, they would use the wrong path
 * 
 * For production builds:
 * - electron-builder uses extraMetadata.name to override package.json's name
 * - So packaged apps get the correct app.name automatically
 * - But this file is still needed for development mode
 */

// Guard against EPIPE errors on stdout/stderr.
// When launched from macOS Finder (not terminal), stdout has no valid pipe
// and any console.log call would crash the app with "Error: write EPIPE".
// This MUST run before any console.log / import that might write to stdout.
import { installPipeGuard } from './utils/pipe-guard'
installPipeGuard()

import { app, dialog } from 'electron'
import { join } from 'path'

// Global safety net: catch any uncaught exception that slips through.
// EPIPE is silently ignored; other fatal errors are shown in a dialog
// so the user sees *something* instead of a silent crash.
process.on('uncaughtException', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EPIPE') return

  // Attempt to show an error dialog (may fail if app isn't ready yet)
  try {
    dialog.showErrorBox(
      'Unexpected Error',
      `${err.message}\n\n${err.stack ?? ''}`
    )
  } catch {
    // ignore — app may not be ready
  }
})

const appName = 'memu-bot'

// Set app name
app.setName(appName)

// Explicitly set userData path since setName doesn't change it automatically
const userDataPath = join(app.getPath('appData'), appName)
app.setPath('userData', userDataPath)

console.log(`[App] Name: ${appName}, UserData: ${app.getPath('userData')}`)

export { appName }
