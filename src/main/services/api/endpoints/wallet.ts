/**
 * Wallet API Endpoints
 *
 * Wallet-related API calls for balance and top-up.
 */

import type { MemuApiClient } from '../client'

// ============================================
// Types
// ============================================

export interface WalletBalanceResponse {
  balance_cents: number
  currency: string
}

export interface CheckoutSessionRequest {
  amount_cents: number
  success_url: string
  cancel_url: string
  allow_promotion_codes?: boolean
}

export interface CheckoutSessionResponse {
  checkout_url: string
  session_id: string
}

// ============================================
// Endpoint Builders
// ============================================

const buildEndpoints = (organizationId: string) => ({
  BALANCE: `/api/v3/organizations/${organizationId}/wallet/balance`,
  CHECKOUT: `/api/v3/organizations/${organizationId}/wallet/topup/checkout_sessions`,
  COUPON: `/api/v3/organizations/${organizationId}/wallet/redeem-coupon`
})

// ============================================
// Wallet API Functions
// ============================================

/**
 * Get wallet balance for the current user
 * @param client The API client instance
 * @param accessToken Firebase access token
 * @param organizationId Organization ID
 * @returns Balance response with cents and currency
 */
export async function getWalletBalance(
  client: MemuApiClient,
  accessToken: string,
  organizationId: string
): Promise<WalletBalanceResponse> {
  console.log('[MemuAPI:Wallet] Fetching wallet balance...', { organizationId })

  const endpoints = buildEndpoints(organizationId)
  const response = await client.request<WalletBalanceResponse>(endpoints.BALANCE, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`
    },
    requiresCsrf: true
  })

  if (!response.data) {
    throw new Error('No data in balance response')
  }

  console.log('[MemuAPI:Wallet] Balance fetched:', {
    balanceCents: response.data.balance_cents,
    currency: response.data.currency
  })

  return response.data
}

/**
 * Create a Stripe checkout session for top-up
 * @param client The API client instance
 * @param accessToken Firebase access token
 * @param request Checkout session parameters
 * @param organizationId Organization ID
 * @returns Checkout session response with URL
 */
export async function createCheckoutSession(
  client: MemuApiClient,
  accessToken: string,
  request: CheckoutSessionRequest,
  organizationId: string
): Promise<CheckoutSessionResponse> {
  console.log('[MemuAPI:Wallet] Creating checkout session...', {
    amountCents: request.amount_cents,
    organizationId
  })

  const endpoints = buildEndpoints(organizationId)
  const response = await client.request<CheckoutSessionResponse>(endpoints.CHECKOUT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`
    },
    body: request,
    requiresCsrf: true
  })

  if (!response.data) {
    throw new Error('No data in checkout response')
  }

  console.log('[MemuAPI:Wallet] Checkout session created:', {
    hasUrl: !!response.data.checkout_url,
    sessionId: response.data.session_id
  })

  return response.data
}

/**
 * Redeem a coupon code
 * @param client The API client instance
 * @param accessToken Firebase access token
 * @param couponCode The coupon code to redeem
 * @param organizationId Organization ID
 * @returns API response (success means coupon applied)
 */
export async function redeemCoupon(
  client: MemuApiClient,
  accessToken: string,
  couponCode: string,
  organizationId: string
): Promise<void> {
  console.log('[MemuAPI:Wallet] Redeeming coupon...', { organizationId })

  const endpoints = buildEndpoints(organizationId)
  await client.request(endpoints.COUPON, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`
    },
    body: { code: couponCode },
    requiresCsrf: true
  })

  console.log('[MemuAPI:Wallet] Coupon redeemed successfully')
}
