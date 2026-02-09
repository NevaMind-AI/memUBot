/**
 * Memu Auth Service - No-op implementation
 *
 * Memu mode does not use authentication.
 */

import { IAuthService, AuthState, LoginResult, LogoutResult } from './types'

const EMPTY_STATE: AuthState = {
  isLoggedIn: false,
  user: null,
  credentials: null,
  easemob: null,
  memuApiKey: null,
  organizationId: null
}

export class MemuAuthService implements IAuthService {
  async initialize(): Promise<void> {
    // No-op
  }

  getAuthState(): AuthState {
    return EMPTY_STATE
  }

  async signInWithEmail(_email: string, _password: string): Promise<LoginResult> {
    return {
      success: false,
      error: 'Authentication is not available in this mode'
    }
  }

  async signOut(): Promise<LogoutResult> {
    return { success: true }
  }

  async getAccessToken(): Promise<string | null> {
    return null
  }

  onAuthStateChanged(_callback: (state: AuthState) => void): () => void {
    // No-op, return empty unsubscribe function
    return () => {}
  }

  destroy(): void {
    // No-op
  }
}
