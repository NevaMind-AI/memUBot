/**
 * Yumi Auth Service - Firebase authentication implementation
 *
 * Flow:
 * 1. User signs in with Firebase (email/password or Google)
 * 2. Get Firebase ID token
 * 3. Exchange Firebase ID token for our backend credentials
 * 4. Use backend credentials for API requests
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
import { IAuthService, AuthState, LoginResult, LogoutResult, UserInfo, AuthCredentials } from './types'

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

// Mock mode - set to false when backend API is ready
// TODO: Replace with actual API calls when backend is implemented
const USE_MOCK_API = true

export class YumiAuthService implements IAuthService {
  private firebaseApp: FirebaseApp | null = null
  private auth: Auth | null = null
  private currentUser: User | null = null
  private credentials: AuthCredentials | null = null
  private listeners: Set<(state: AuthState) => void> = new Set()
  private credentialsPath: string
  private unsubscribeFirebase: (() => void) | null = null

  constructor() {
    const userDataPath = app.getPath('userData')
    const authDir = join(userDataPath, 'auth')
    if (!existsSync(authDir)) {
      mkdirSync(authDir, { recursive: true })
    }
    this.credentialsPath = join(authDir, 'credentials.json')
  }

  async initialize(): Promise<void> {
    console.log('[YumiAuth] Initializing Firebase auth service')

    // Initialize Firebase
    try {
      const firebaseConfig = getFirebaseConfig()
      this.firebaseApp = initializeApp(firebaseConfig)
      this.auth = getAuth(this.firebaseApp)

      // Listen to Firebase auth state changes
      this.unsubscribeFirebase = firebaseOnAuthStateChanged(this.auth, async (user) => {
        console.log('[YumiAuth] Firebase auth state changed:', user?.email || 'signed out')
        this.currentUser = user

        if (user) {
          // User signed in, try to get/refresh credentials
          await this.refreshCredentialsIfNeeded()
        } else {
          // User signed out
          this.credentials = null
          this.clearStoredCredentials()
        }

        this.notifyListeners()
      })

      // Load stored credentials
      this.loadStoredCredentials()

      console.log('[YumiAuth] Firebase initialized successfully')
    } catch (error) {
      console.error('[YumiAuth] Failed to initialize Firebase:', error)
    }
  }

  getAuthState(): AuthState {
    return {
      isLoggedIn: !!this.currentUser && !!this.credentials,
      user: this.currentUser ? this.mapFirebaseUser(this.currentUser) : null,
      credentials: this.credentials
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

      // Exchange Firebase token for backend credentials
      const exchangeResult = await this.exchangeTokenForCredentials(user)
      if (!exchangeResult.success) {
        // Sign out from Firebase if token exchange fails
        await firebaseSignOut(this.auth)
        return { success: false, error: exchangeResult.error }
      }

      console.log('[YumiAuth] Sign in successful')
      return {
        success: true,
        user: this.mapFirebaseUser(user)
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
      this.credentials = null
      this.clearStoredCredentials()
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
      // Get Firebase ID token
      const idToken = await user.getIdToken()

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
        this.storeCredentials()
        return { success: true }
      }

      // Real API mode: Exchange Firebase token for backend credentials
      // TODO: Implement when backend API is ready
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

      this.storeCredentials()
      return { success: true }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('[YumiAuth] Token exchange failed:', errorMessage)
      return { success: false, error: 'Failed to authenticate with server' }
    }
  }

  private async refreshCredentialsIfNeeded(): Promise<void> {
    if (!this.credentials?.refreshToken || !this.currentUser) {
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
        const idToken = await this.currentUser.getIdToken(true) // Force refresh
        this.credentials = {
          accessToken: idToken,
          refreshToken: this.credentials.refreshToken,
          expiresAt: Date.now() + 3600 * 1000
        }
        this.storeCredentials()
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
        this.clearStoredCredentials()
        return
      }

      const data = await response.json()
      this.credentials = {
        accessToken: data.accessToken,
        refreshToken: data.refreshToken || this.credentials.refreshToken,
        expiresAt: Date.now() + (data.expiresIn || 3600) * 1000
      }

      this.storeCredentials()
    } catch (error) {
      console.error('[YumiAuth] Failed to refresh credentials:', error)
    }
  }

  private storeCredentials(): void {
    if (!this.credentials) return
    try {
      writeFileSync(this.credentialsPath, JSON.stringify(this.credentials), 'utf-8')
    } catch (error) {
      console.error('[YumiAuth] Failed to store credentials:', error)
    }
  }

  private loadStoredCredentials(): void {
    try {
      if (existsSync(this.credentialsPath)) {
        const data = readFileSync(this.credentialsPath, 'utf-8')
        this.credentials = JSON.parse(data)
        console.log('[YumiAuth] Loaded stored credentials')
      }
    } catch (error) {
      console.error('[YumiAuth] Failed to load stored credentials:', error)
      this.credentials = null
    }
  }

  private clearStoredCredentials(): void {
    try {
      if (existsSync(this.credentialsPath)) {
        writeFileSync(this.credentialsPath, '', 'utf-8')
      }
    } catch (error) {
      console.error('[YumiAuth] Failed to clear stored credentials:', error)
    }
  }

  private notifyListeners(): void {
    const state = this.getAuthState()
    this.listeners.forEach((callback) => callback(state))
  }
}
