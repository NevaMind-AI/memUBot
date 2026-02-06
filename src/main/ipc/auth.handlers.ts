/**
 * Auth IPC Handlers
 *
 * Handles authentication-related IPC calls from renderer
 */

import { ipcMain, BrowserWindow } from 'electron'
import { getAuthService, AuthState } from '../services/auth'

export function registerAuthHandlers(): void {
  const authService = getAuthService()

  // Get current auth state
  ipcMain.handle('auth:getState', async (): Promise<AuthState> => {
    return authService.getAuthState()
  })

  // Sign in with email/password
  ipcMain.handle(
    'auth:signInWithEmail',
    async (_event, email: string, password: string) => {
      return authService.signInWithEmail(email, password)
    }
  )

  // Sign out
  ipcMain.handle('auth:signOut', async () => {
    return authService.signOut()
  })

  // Get access token
  ipcMain.handle('auth:getAccessToken', async (): Promise<string | null> => {
    return authService.getAccessToken()
  })

  // Listen to auth state changes and forward to renderer
  authService.onAuthStateChanged((state) => {
    // Send to all windows
    BrowserWindow.getAllWindows().forEach((window) => {
      if (!window.isDestroyed()) {
        window.webContents.send('auth:stateChanged', state)
      }
    })
  })

  console.log('[IPC] Auth handlers registered')
}
