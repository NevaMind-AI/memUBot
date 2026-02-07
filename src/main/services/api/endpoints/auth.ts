/**
 * Auth API Endpoints
 * 
 * Authentication-related API calls.
 */

import type { MemuApiClient } from '../client'
import type { LoginFromYumiResponse } from '../types'

// ============================================
// Endpoints
// ============================================

const ENDPOINTS = {
  LOGIN_FROM_YUMI: '/api/v3/auth/login_from_yumi'
} as const

// ============================================
// Auth API Functions
// ============================================

/**
 * Login using Firebase ID token from Yumi app
 * @param client The API client instance
 * @param firebaseIdToken The Firebase ID token
 * @returns Login response with user/bot tokens and API key
 */
export async function loginFromYumi(
  client: MemuApiClient,
  firebaseIdToken: string
): Promise<LoginFromYumiResponse> {
  console.log('[MemuAPI:Auth] Calling loginFromYumi...')

  const response = await client.request<LoginFromYumiResponse>(ENDPOINTS.LOGIN_FROM_YUMI, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${firebaseIdToken}`
    },
    requiresCsrf: true
  })

  if (!response.data) {
    throw new Error('No data in login response')
  }

  console.log('[MemuAPI:Auth] loginFromYumi successful:', {
    userName: response.data.user_name,
    botName: response.data.bot_name,
    hasApiKey: !!response.data.api_key
  })

  return response.data
}
