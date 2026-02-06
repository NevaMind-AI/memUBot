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
import { app } from 'electron'
import { join } from 'path'

const appMode = import.meta.env.MAIN_VITE_APP_MODE || 'memu'
const appName = appMode === 'yumi' ? 'yumi' : 'memu-bot'

// Set app name
app.setName(appName)

// Explicitly set userData path since setName doesn't change it automatically
const userDataPath = join(app.getPath('appData'), appName)
app.setPath('userData', userDataPath)

console.log(`[App] Mode: ${appMode}, Name: ${appName}, UserData: ${app.getPath('userData')}`)

export { appMode, appName }
