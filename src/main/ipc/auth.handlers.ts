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
    const state = authService.getAuthState()
    console.log('[AuthIPC] getState:', {
      isLoggedIn: state.isLoggedIn,
      hasUser: !!state.user,
      hasCredentials: !!state.credentials,
      easemob: state.easemob ? { agentId: state.easemob.agentId, userId: state.easemob.userId } : null
    })
    return state
  })

  // Sign in with email/password
  ipcMain.handle(
    'auth:signInWithEmail',
    async (_event, email: string, password: string) => {
      const result = await authService.signInWithEmail(email, password)
      console.log('[AuthIPC] signInWithEmail result:', {
        success: result.success,
        hasUser: !!result.user,
        easemob: result.easemob ? { agentId: result.easemob.agentId, userId: result.easemob.userId } : null
      })
      return result
    }
  )

  // Sign up with email/password
  ipcMain.handle(
    'auth:signUpWithEmail',
    async (_event, email: string, password: string) => {
      const result = await authService.signUpWithEmail(email, password)
      console.log('[AuthIPC] signUpWithEmail result:', {
        success: result.success,
        hasUser: !!result.user,
        easemob: result.easemob ? { agentId: result.easemob.agentId, userId: result.easemob.userId } : null
      })
      return result
    }
  )

  // Reset password
  ipcMain.handle('auth:resetPassword', async (_event, email: string) => {
    const result = await authService.resetPassword(email)
    console.log('[AuthIPC] resetPassword result:', { success: result.success })
    return result
  })

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
    console.log('[AuthIPC] stateChanged -> renderer:', {
      isLoggedIn: state.isLoggedIn,
      hasUser: !!state.user,
      hasCredentials: !!state.credentials,
      easemob: state.easemob ? { agentId: state.easemob.agentId, userId: state.easemob.userId } : null
    })
    // Send to all windows
    BrowserWindow.getAllWindows().forEach((window) => {
      if (!window.isDestroyed()) {
        window.webContents.send('auth:stateChanged', state)
      }
    })
  })

  console.log('[IPC] Auth handlers registered')
}
