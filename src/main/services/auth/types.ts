/**
 * Auth Service Types
 *
 * Only Yumi mode uses Firebase authentication.
 * Memu mode has a no-op implementation.
 */

export interface UserInfo {
  uid: string
  email: string | null
  displayName: string | null
  photoURL: string | null
}

export interface AuthCredentials {
  accessToken: string
  refreshToken: string
  expiresAt: number // Unix timestamp in milliseconds
}

export interface AuthState {
  isLoggedIn: boolean
  user: UserInfo | null
  credentials: AuthCredentials | null
}

export interface LoginResult {
  success: boolean
  user?: UserInfo
  error?: string
}

export interface LogoutResult {
  success: boolean
  error?: string
}

export interface IAuthService {
  /**
   * Initialize the auth service
   */
  initialize(): Promise<void>

  /**
   * Get current auth state
   */
  getAuthState(): AuthState

  /**
   * Sign in with email and password
   */
  signInWithEmail(email: string, password: string): Promise<LoginResult>

  /**
   * Sign out
   */
  signOut(): Promise<LogoutResult>

  /**
   * Get valid access token (refreshes if needed)
   */
  getAccessToken(): Promise<string | null>

  /**
   * Register auth state change listener
   */
  onAuthStateChanged(callback: (state: AuthState) => void): () => void

  /**
   * Destroy the service
   */
  destroy(): void
}
