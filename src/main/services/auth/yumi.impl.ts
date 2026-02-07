/**
 * Yumi Auth Service - Firebase authentication implementation
 *
 * Flow:
 * 1. User signs in with Firebase (email/password or Google)
 * 2. Get Firebase ID token
 * 3. Exchange Firebase ID token for our backend credentials
 * 4. Use backend credentials for API requests
 *
 * Session Persistence:
 * - Firebase SDK doesn't persist auth state in Electron main process
 * - We save Firebase refresh token locally and restore session on startup
 * - Uses Firebase REST API to refresh tokens when needed
 */

import { app } from 'electron'
import { initializeApp, FirebaseApp } from 'firebase/app'
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged as firebaseOnAuthStateChanged,
  Auth,
  User
} from 'firebase/auth'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import {
  IAuthService,
  AuthState,
  LoginResult,
  LogoutResult,
  UserInfo,
  AuthCredentials,
  EasemobAuthInfo
} from './types'
import { getMemuApiClient, authApi } from '../api'

// Firebase configuration - using import.meta.env with MAIN_VITE_ prefix
// electron-vite exposes MAIN_VITE_* variables to main process via import.meta.env
function getFirebaseConfig() {
  const config = {
    apiKey: import.meta.env.MAIN_VITE_FIREBASE_API_KEY || '',
    authDomain: import.meta.env.MAIN_VITE_FIREBASE_AUTH_DOMAIN || '',
    projectId: import.meta.env.MAIN_VITE_FIREBASE_PROJECT_ID || '',
    storageBucket: import.meta.env.MAIN_VITE_FIREBASE_STORAGE_BUCKET || '',
    messagingSenderId: import.meta.env.MAIN_VITE_FIREBASE_MESSAGING_SENDER_ID || '',
    appId: import.meta.env.MAIN_VITE_FIREBASE_APP_ID || ''
  }
  console.log('[YumiAuth] Firebase config loaded:', {
    apiKey: config.apiKey ? `${config.apiKey.substring(0, 10)}...` : '(empty)',
    authDomain: config.authDomain || '(empty)',
    projectId: config.projectId || '(empty)'
  })
  return config
}

// Firebase REST API for token refresh
const FIREBASE_TOKEN_API = 'https://securetoken.googleapis.com/v1/token'

// Token refresh threshold: refresh if less than 45 minutes remaining (token valid for 1 hour)
const TOKEN_REFRESH_THRESHOLD_MS = 45 * 60 * 1000

/**
 * Stored session data for persistence
 */
interface StoredSession {
  // Firebase refresh token for session restoration
  firebaseRefreshToken: string
  // Firebase ID token (cached)
  firebaseIdToken: string
  // When the ID token was last refreshed
  idTokenRefreshedAt: number
  // User info for offline display
  userInfo: UserInfo
  // Backend credentials
  credentials: AuthCredentials
  // Easemob info
  easemob: EasemobAuthInfo | null
  // Memu API key for backend requests
  memuApiKey: string | null
}

export class YumiAuthService implements IAuthService {
  private firebaseApp: FirebaseApp | null = null
  private auth: Auth | null = null
  private currentUser: User | null = null
  private credentials: AuthCredentials | null = null
  private easemobInfo: EasemobAuthInfo | null = null
  private memuApiKey: string | null = null
  private listeners: Set<(state: AuthState) => void> = new Set()
  private sessionPath: string
  private unsubscribeFirebase: (() => void) | null = null

  // Session persistence
  private firebaseRefreshToken: string | null = null
  private firebaseIdToken: string | null = null
  private idTokenRefreshedAt: number = 0
  private storedUserInfo: UserInfo | null = null
  private sessionRestored: boolean = false

  constructor() {
    const userDataPath = app.getPath('userData')
    const authDir = join(userDataPath, 'auth')
    if (!existsSync(authDir)) {
      mkdirSync(authDir, { recursive: true })
    }
    this.sessionPath = join(authDir, 'session.json')
  }

  async initialize(): Promise<void> {
    console.log('[YumiAuth] Initializing Firebase auth service')

    // Initialize Firebase
    try {
      const firebaseConfig = getFirebaseConfig()
      this.firebaseApp = initializeApp(firebaseConfig)
      this.auth = getAuth(this.firebaseApp)

      // Load stored session first
      this.loadStoredSession()

      // Try to restore session if we have a stored refresh token
      if (this.firebaseRefreshToken && !this.sessionRestored) {
        console.log('[YumiAuth] Found stored session, attempting to restore...')
        await this.restoreSession()
      }

      // Listen to Firebase auth state changes
      this.unsubscribeFirebase = firebaseOnAuthStateChanged(this.auth, async (user) => {
        console.log('[YumiAuth] Firebase auth state changed:', user?.email || 'signed out')
        this.currentUser = user

        if (user) {
          // User signed in via Firebase, extract refresh token
          this.extractAndStoreFirebaseTokens(user)
          // Try to get/refresh credentials
          await this.refreshCredentialsIfNeeded()
        } else if (!this.sessionRestored) {
          // User signed out and no restored session
          this.credentials = null
          this.clearStoredSession()
        }

        this.notifyListeners()
      })

      console.log('[YumiAuth] Firebase initialized successfully')
    } catch (error) {
      console.error('[YumiAuth] Failed to initialize Firebase:', error)
    }
  }

  getAuthState(): AuthState {
    // Use current Firebase user if available, otherwise use stored user info from restored session
    const user = this.currentUser
      ? this.mapFirebaseUser(this.currentUser)
      : this.storedUserInfo

    return {
      isLoggedIn: !!user && !!this.credentials,
      user,
      credentials: this.credentials,
      easemob: this.easemobInfo,
      memuApiKey: this.memuApiKey
    }
  }

  async signInWithEmail(email: string, password: string): Promise<LoginResult> {
    if (!this.auth) {
      return { success: false, error: 'Auth service not initialized' }
    }

    try {
      console.log('[YumiAuth] Signing in with email:', email)
      const userCredential = await signInWithEmailAndPassword(this.auth, email, password)
      const user = userCredential.user

      // Extract and store Firebase tokens for session persistence
      this.extractAndStoreFirebaseTokens(user)

      // Exchange Firebase token for backend credentials
      const exchangeResult = await this.exchangeTokenForCredentials(user)
      if (!exchangeResult.success) {
        // Sign out from Firebase if token exchange fails
        await firebaseSignOut(this.auth)
        this.clearStoredSession()
        return { success: false, error: exchangeResult.error }
      }

      // Store user info for session restoration
      this.storedUserInfo = this.mapFirebaseUser(user)

      // Save complete session to disk
      this.saveSession()

      // Notify renderer with updated easemob info immediately
      this.notifyListeners()

      console.log('[YumiAuth] Sign in successful')
      return {
        success: true,
        user: this.mapFirebaseUser(user),
        easemob: this.easemobInfo || undefined
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('[YumiAuth] Sign in failed:', errorMessage)
      return { success: false, error: this.mapFirebaseError(error) }
    }
  }

  async signOut(): Promise<LogoutResult> {
    if (!this.auth) {
      return { success: true }
    }

    try {
      console.log('[YumiAuth] Signing out')

      // Clear all session data BEFORE firebaseSignOut
      // firebaseSignOut triggers onAuthStateChanged callback, which calls notifyListeners.
      // If we clear after, the callback sees stale data (easemob still set, sessionRestored still true)
      // and the renderer won't disconnect Easemob.
      this.credentials = null
      this.easemobInfo = null
      this.memuApiKey = null
      this.currentUser = null
      this.firebaseRefreshToken = null
      this.firebaseIdToken = null
      this.idTokenRefreshedAt = 0
      this.storedUserInfo = null
      this.sessionRestored = false
      this.clearStoredSession()

      // Now sign out from Firebase (callback will see cleared state)
      await firebaseSignOut(this.auth)

      // Explicitly notify in case the Firebase callback didn't fire or was skipped
      this.notifyListeners()

      console.log('[YumiAuth] Sign out successful')
      return { success: true }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('[YumiAuth] Sign out failed:', errorMessage)
      return { success: false, error: errorMessage }
    }
  }

  async getAccessToken(): Promise<string | null> {
    if (!this.credentials) {
      return null
    }

    // Check if token is expired or about to expire (5 min buffer)
    const now = Date.now()
    if (this.credentials.expiresAt - now < 5 * 60 * 1000) {
      await this.refreshCredentialsIfNeeded()
    }

    return this.credentials?.accessToken || null
  }

  /**
   * Get a valid Firebase ID token (async with auto-refresh)
   * Refreshes if older than TOKEN_REFRESH_THRESHOLD_MS (45 minutes)
   */
  async getFirebaseIdToken(): Promise<string | null> {
    // If we have a current Firebase user, use it directly
    if (this.currentUser) {
      const now = Date.now()
      const tokenAge = now - this.idTokenRefreshedAt

      // Refresh if token is older than threshold
      if (tokenAge > TOKEN_REFRESH_THRESHOLD_MS) {
        console.log('[YumiAuth] Firebase ID token is stale, refreshing...')
        try {
          this.firebaseIdToken = await this.currentUser.getIdToken(true)
          this.idTokenRefreshedAt = now
          this.saveSession()
        } catch (error) {
          console.error('[YumiAuth] Failed to refresh Firebase ID token:', error)
        }
      }

      return this.firebaseIdToken
    }

    // No current user, try to refresh using stored refresh token
    if (this.firebaseRefreshToken) {
      const now = Date.now()
      const tokenAge = now - this.idTokenRefreshedAt

      // Refresh if token is older than threshold
      if (tokenAge > TOKEN_REFRESH_THRESHOLD_MS || !this.firebaseIdToken) {
        console.log('[YumiAuth] Refreshing Firebase ID token via REST API...')
        await this.refreshFirebaseTokenViaRestApi()
      }

      return this.firebaseIdToken
    }

    return null
  }

  onAuthStateChanged(callback: (state: AuthState) => void): () => void {
    this.listeners.add(callback)
    // Immediately call with current state
    callback(this.getAuthState())
    return () => {
      this.listeners.delete(callback)
    }
  }

  destroy(): void {
    console.log('[YumiAuth] Destroying auth service')
    if (this.unsubscribeFirebase) {
      this.unsubscribeFirebase()
      this.unsubscribeFirebase = null
    }
    this.listeners.clear()
  }

  // Private methods

  private mapFirebaseUser(user: User): UserInfo {
    return {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL
    }
  }

  private mapFirebaseError(error: unknown): string {
    if (error instanceof Error) {
      const code = (error as { code?: string }).code
      switch (code) {
        case 'auth/invalid-email':
          return 'Invalid email address'
        case 'auth/user-disabled':
          return 'This account has been disabled'
        case 'auth/user-not-found':
          return 'No account found with this email'
        case 'auth/wrong-password':
          return 'Incorrect password'
        case 'auth/invalid-credential':
          return 'Invalid email or password'
        case 'auth/too-many-requests':
          return 'Too many failed attempts. Please try again later'
        case 'auth/network-request-failed':
          return 'Network error. Please check your connection'
        default:
          return error.message
      }
    }
    return 'An unknown error occurred'
  }

  private async exchangeTokenForCredentials(
    user: User
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Get Firebase ID token (use cached one if available and fresh)
      const idToken = this.firebaseIdToken || (await user.getIdToken())

      // Call Memu API to exchange Firebase token for credentials
      console.log('[YumiAuth] Exchanging Firebase token for Memu credentials...')
      const apiClient = getMemuApiClient()
      const loginResult = await authApi.loginFromYumi(apiClient, idToken)

      // Set credentials from API response
      this.credentials = {
        accessToken: idToken, // Use Firebase ID token as access token
        refreshToken: `memu_refresh_${user.uid}_${Date.now()}`,
        expiresAt: Date.now() + 3600 * 1000 // Token expires in 1 hour
      }

      // Set Easemob info from API response
      this.easemobInfo = {
        agentId: loginResult.bot_name,
        userId: loginResult.user_name,
        token: loginResult.bot_token
      }

      // Set Memu API key from API response
      this.memuApiKey = loginResult.api_key

      console.log('[YumiAuth] Credentials set from API:', {
        agentId: this.easemobInfo.agentId,
        userId: this.easemobInfo.userId,
        easemobTokenPreview: `${this.easemobInfo.token.substring(0, 8)}...`,
        memuApiKeyPreview: `${this.memuApiKey.substring(0, 12)}...`
      })

      return { success: true }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('[YumiAuth] Token exchange failed:', errorMessage)
      return { success: false, error: 'Failed to authenticate with server' }
    }
  }

  private async refreshCredentialsIfNeeded(): Promise<void> {
    if (!this.credentials?.refreshToken) {
      return
    }

    // Check if token needs refresh (5 min buffer)
    const now = Date.now()
    if (this.credentials.expiresAt - now > 5 * 60 * 1000) {
      return // Token still valid
    }

    try {
      console.log('[YumiAuth] Refreshing credentials...')

      // Get fresh Firebase ID token
      let idToken: string | null = null
      if (this.currentUser) {
        idToken = await this.currentUser.getIdToken(true)
        this.firebaseIdToken = idToken
        this.idTokenRefreshedAt = now
      } else if (this.firebaseRefreshToken) {
        // No current user, refresh via REST API
        await this.refreshFirebaseTokenViaRestApi()
        idToken = this.firebaseIdToken
      }

      if (!idToken) {
        console.error('[YumiAuth] Cannot refresh credentials: no valid Firebase token')
        return
      }

      // Re-authenticate with Memu API using fresh Firebase token
      const apiClient = getMemuApiClient()
      const loginResult = await authApi.loginFromYumi(apiClient, idToken)

      this.credentials = {
        accessToken: idToken,
        refreshToken: this.credentials.refreshToken,
        expiresAt: Date.now() + 3600 * 1000
      }

      // Update Easemob info
      this.easemobInfo = {
        agentId: loginResult.bot_name,
        userId: loginResult.user_name,
        token: loginResult.bot_token
      }

      // Update API key
      this.memuApiKey = loginResult.api_key

      this.saveSession()
      console.log('[YumiAuth] Credentials refreshed successfully')
    } catch (error) {
      console.error('[YumiAuth] Failed to refresh credentials:', error)
    }
  }

  // ==================== Session Persistence Methods ====================

  /**
   * Extract Firebase tokens from User object for persistence
   * Firebase stores refresh token internally in stsTokenManager
   */
  private extractAndStoreFirebaseTokens(user: User): void {
    try {
      // Access internal token manager (not in public API but available)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const userAny = user as any
      const stsTokenManager = userAny.stsTokenManager

      if (stsTokenManager) {
        this.firebaseRefreshToken = stsTokenManager.refreshToken || null
        this.firebaseIdToken = stsTokenManager.accessToken || null
        this.idTokenRefreshedAt = Date.now()

        console.log('[YumiAuth] Extracted Firebase tokens:', {
          hasRefreshToken: !!this.firebaseRefreshToken,
          hasIdToken: !!this.firebaseIdToken
        })
      }
    } catch (error) {
      console.error('[YumiAuth] Failed to extract Firebase tokens:', error)
    }
  }

  /**
   * Restore session from stored refresh token using Firebase REST API
   */
  private async restoreSession(): Promise<void> {
    if (!this.firebaseRefreshToken) {
      console.log('[YumiAuth] No refresh token available for session restore')
      return
    }

    try {
      console.log('[YumiAuth] Restoring session from stored refresh token...')

      // Check if stored ID token is still fresh enough
      const now = Date.now()
      const tokenAge = now - this.idTokenRefreshedAt

      if (tokenAge > TOKEN_REFRESH_THRESHOLD_MS || !this.firebaseIdToken) {
        // Token is stale, refresh via REST API
        const refreshed = await this.refreshFirebaseTokenViaRestApi()
        if (!refreshed) {
          console.log('[YumiAuth] Failed to refresh token, clearing session')
          this.clearStoredSession()
          return
        }
      }

      // We have a valid ID token now, mark session as restored
      this.sessionRestored = true

      // If we have stored credentials, verify they're still valid
      if (this.credentials) {
        // Check if backend credentials need refresh
        if (this.credentials.expiresAt - now < 5 * 60 * 1000) {
          await this.refreshCredentialsIfNeeded()
        }
      } else if (this.firebaseIdToken && this.storedUserInfo) {
        // No stored credentials, need to exchange token with Memu API
        console.log('[YumiAuth] No stored credentials, exchanging token with Memu API...')
        try {
          const apiClient = getMemuApiClient()
          const loginResult = await authApi.loginFromYumi(apiClient, this.firebaseIdToken)

          this.credentials = {
            accessToken: this.firebaseIdToken,
            refreshToken: `memu_refresh_${this.storedUserInfo.uid}_${Date.now()}`,
            expiresAt: Date.now() + 3600 * 1000
          }

          this.easemobInfo = {
            agentId: loginResult.bot_name,
            userId: loginResult.user_name,
            token: loginResult.bot_token
          }

          this.memuApiKey = loginResult.api_key
          this.saveSession()
        } catch (error) {
          console.error('[YumiAuth] Failed to exchange token during session restore:', error)
        }
      }

      console.log('[YumiAuth] Session restored successfully:', {
        hasIdToken: !!this.firebaseIdToken,
        hasCredentials: !!this.credentials,
        hasUserInfo: !!this.storedUserInfo
      })

      this.notifyListeners()
    } catch (error) {
      console.error('[YumiAuth] Failed to restore session:', error)
      this.clearStoredSession()
    }
  }

  /**
   * Refresh Firebase ID token using REST API
   * https://firebase.google.com/docs/reference/rest/auth#section-refresh-token
   */
  private async refreshFirebaseTokenViaRestApi(): Promise<boolean> {
    if (!this.firebaseRefreshToken) {
      return false
    }

    const apiKey = import.meta.env.MAIN_VITE_FIREBASE_API_KEY
    if (!apiKey) {
      console.error('[YumiAuth] Firebase API key not configured')
      return false
    }

    try {
      console.log('[YumiAuth] Refreshing Firebase token via REST API...')

      const response = await fetch(`${FIREBASE_TOKEN_API}?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(this.firebaseRefreshToken)}`
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        console.error('[YumiAuth] Firebase token refresh failed:', errorData)

        // If refresh token is invalid, clear session
        if (errorData.error?.message === 'INVALID_REFRESH_TOKEN' ||
            errorData.error?.message === 'TOKEN_EXPIRED') {
          this.clearStoredSession()
        }
        return false
      }

      const data = await response.json()

      // Update tokens
      this.firebaseIdToken = data.id_token
      this.firebaseRefreshToken = data.refresh_token // Firebase may rotate refresh tokens
      this.idTokenRefreshedAt = Date.now()

      console.log('[YumiAuth] Firebase token refreshed successfully')
      this.saveSession()

      return true
    } catch (error) {
      console.error('[YumiAuth] Firebase token refresh error:', error)
      return false
    }
  }

  /**
   * Save complete session to disk
   */
  private saveSession(): void {
    if (!this.firebaseRefreshToken) return

    try {
      const session: StoredSession = {
        firebaseRefreshToken: this.firebaseRefreshToken,
        firebaseIdToken: this.firebaseIdToken || '',
        idTokenRefreshedAt: this.idTokenRefreshedAt,
        userInfo: this.storedUserInfo || (this.currentUser ? this.mapFirebaseUser(this.currentUser) : { uid: '', email: null, displayName: null, photoURL: null }),
        credentials: this.credentials || { accessToken: '', refreshToken: '', expiresAt: 0 },
        easemob: this.easemobInfo,
        memuApiKey: this.memuApiKey
      }

      writeFileSync(this.sessionPath, JSON.stringify(session, null, 2), 'utf-8')
      console.log('[YumiAuth] Session saved to disk')
    } catch (error) {
      console.error('[YumiAuth] Failed to save session:', error)
    }
  }

  /**
   * Load stored session from disk
   */
  private loadStoredSession(): void {
    try {
      if (!existsSync(this.sessionPath)) {
        console.log('[YumiAuth] No stored session found')
        return
      }

      const data = readFileSync(this.sessionPath, 'utf-8')
      if (!data.trim()) {
        console.log('[YumiAuth] Stored session is empty')
        return
      }

      const session: StoredSession = JSON.parse(data)

      if (session.firebaseRefreshToken) {
        this.firebaseRefreshToken = session.firebaseRefreshToken
        this.firebaseIdToken = session.firebaseIdToken || null
        this.idTokenRefreshedAt = session.idTokenRefreshedAt || 0
        this.storedUserInfo = session.userInfo || null
        this.credentials = session.credentials?.accessToken ? session.credentials : null
        this.easemobInfo = session.easemob || null
        this.memuApiKey = session.memuApiKey || null

        console.log('[YumiAuth] Loaded stored session:', {
          hasRefreshToken: !!this.firebaseRefreshToken,
          hasIdToken: !!this.firebaseIdToken,
          hasUserInfo: !!this.storedUserInfo,
          hasCredentials: !!this.credentials,
          hasMemuApiKey: !!this.memuApiKey,
          tokenAge: this.idTokenRefreshedAt ? `${Math.round((Date.now() - this.idTokenRefreshedAt) / 60000)} minutes` : 'unknown'
        })
      }
    } catch (error) {
      console.error('[YumiAuth] Failed to load stored session:', error)
      this.clearStoredSession()
    }
  }

  /**
   * Clear stored session from disk
   */
  private clearStoredSession(): void {
    try {
      if (existsSync(this.sessionPath)) {
        writeFileSync(this.sessionPath, '', 'utf-8')
        console.log('[YumiAuth] Stored session cleared')
      }
    } catch (error) {
      console.error('[YumiAuth] Failed to clear stored session:', error)
    }
  }

  private notifyListeners(): void {
    const state = this.getAuthState()
    console.log('[YumiAuth] notifyListeners:', {
      isLoggedIn: state.isLoggedIn,
      hasUser: !!state.user,
      hasCredentials: !!state.credentials,
      easemob: state.easemob ? { agentId: state.easemob.agentId, userId: state.easemob.userId } : null
    })
    this.listeners.forEach((callback) => callback(state))
  }
}
