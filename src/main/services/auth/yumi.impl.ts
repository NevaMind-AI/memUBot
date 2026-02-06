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

// Backend API endpoint for token exchange
function getApiBaseUrl(): string {
  return import.meta.env.MAIN_VITE_YUMI_API_BASE_URL || 'https://api.yumi.app'
}

// Firebase REST API for token refresh
const FIREBASE_TOKEN_API = 'https://securetoken.googleapis.com/v1/token'

// Token refresh threshold: refresh if less than 45 minutes remaining (token valid for 1 hour)
const TOKEN_REFRESH_THRESHOLD_MS = 45 * 60 * 1000

// Mock mode - set to false when backend API is ready
// TODO: Replace with actual API calls when backend is implemented
const USE_MOCK_API = true

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
}

export class YumiAuthService implements IAuthService {
  private firebaseApp: FirebaseApp | null = null
  private auth: Auth | null = null
  private currentUser: User | null = null
  private credentials: AuthCredentials | null = null
  private easemobInfo: EasemobAuthInfo | null = null
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
      easemob: this.easemobInfo
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
      await firebaseSignOut(this.auth)

      // Clear all session data
      this.credentials = null
      this.easemobInfo = null
      this.firebaseRefreshToken = null
      this.firebaseIdToken = null
      this.idTokenRefreshedAt = 0
      this.storedUserInfo = null
      this.sessionRestored = false
      this.clearStoredSession()

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

      // Mock mode: Firebase login is sufficient, generate mock credentials
      if (USE_MOCK_API) {
        console.log('[YumiAuth] Mock mode: Using Firebase token as credentials')
        this.credentials = {
          // Use Firebase ID token as access token in mock mode
          accessToken: idToken,
          refreshToken: `mock_refresh_${user.uid}_${Date.now()}`,
          // Token expires in 1 hour
          expiresAt: Date.now() + 3600 * 1000
        }
        // Mock Easemob info - replace with backend response later
        this.easemobInfo = {
          agentId: 'yumi-bot',
          userId: 'yumi-app',
          token:
            'YWMtWgKRagNIEfGTeSd7kwkxqUYA2pgGPE_uh0ie2zAWRYvq6mIwA0IR8YNMObREIyM8AwMAAAGcMoqcgDeeSAA0ZCKJtyOmN-f0ZtRYf8yPV4jRD2hSzj2KJbq0rsW0Cg'
        }
        console.log('[YumiAuth] Mock easemob info set:', {
          agentId: this.easemobInfo.agentId,
          userId: this.easemobInfo.userId,
          tokenPreview: `${this.easemobInfo.token.substring(0, 8)}...`
        })
        return { success: true }
      }

      // Real API mode: Exchange Firebase token for backend credentials
      // TODO: Implement when backend API is ready
      // Expected response fields:
      // - accessToken, refreshToken, expiresIn
      // - easemobAgentId, easemobUserId, easemobToken
      const response = await fetch(`${getApiBaseUrl()}/auth/exchange`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ firebaseToken: idToken })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        return {
          success: false,
          error: errorData.message || `Server error: ${response.status}`
        }
      }

      const data = await response.json()
      this.credentials = {
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        expiresAt: Date.now() + (data.expiresIn || 3600) * 1000
      }
      this.easemobInfo = {
        agentId: data.easemobAgentId,
        userId: data.easemobUserId,
        token: data.easemobToken
      }

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
      // Mock mode: Refresh using Firebase token
      if (USE_MOCK_API) {
        console.log('[YumiAuth] Mock mode: Refreshing credentials with Firebase token')

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

        this.credentials = {
          accessToken: idToken,
          refreshToken: this.credentials.refreshToken,
          expiresAt: Date.now() + 3600 * 1000
        }
        this.saveSession()
        return
      }

      // Real API mode: Call refresh endpoint
      // TODO: Implement when backend API is ready
      const response = await fetch(`${getApiBaseUrl()}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ refreshToken: this.credentials.refreshToken })
      })

      if (!response.ok) {
        // Refresh failed, clear credentials
        this.credentials = null
        this.clearStoredSession()
        return
      }

      const data = await response.json()
      this.credentials = {
        accessToken: data.accessToken,
        refreshToken: data.refreshToken || this.credentials.refreshToken,
        expiresAt: Date.now() + (data.expiresIn || 3600) * 1000
      }

      this.saveSession()
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
      } else {
        // No stored credentials, need to exchange token
        // Create a minimal pseudo-user for exchange (mock mode only)
        if (USE_MOCK_API && this.firebaseIdToken && this.storedUserInfo) {
          this.credentials = {
            accessToken: this.firebaseIdToken,
            refreshToken: `mock_refresh_${this.storedUserInfo.uid}_${Date.now()}`,
            expiresAt: Date.now() + 3600 * 1000
          }
          // Restore mock Easemob info
          if (!this.easemobInfo) {
            this.easemobInfo = {
              agentId: 'yumi-bot',
              userId: 'yumi-app',
              token:
                'YWMtWgKRagNIEfGTeSd7kwkxqUYA2pgGPE_uh0ie2zAWRYvq6mIwA0IR8YNMObREIyM8AwMAAAGcMoqcgDeeSAA0ZCKJtyOmN-f0ZtRYf8yPV4jRD2hSzj2KJbq0rsW0Cg'
            }
          }
          this.saveSession()
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
        easemob: this.easemobInfo
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

        console.log('[YumiAuth] Loaded stored session:', {
          hasRefreshToken: !!this.firebaseRefreshToken,
          hasIdToken: !!this.firebaseIdToken,
          hasUserInfo: !!this.storedUserInfo,
          hasCredentials: !!this.credentials,
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
