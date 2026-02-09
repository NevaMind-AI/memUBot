/**
 * Billing IPC Handlers
 *
 * Handles billing-related IPC calls from renderer (balance, top-up)
 */

import { ipcMain, shell } from 'electron'
import { getMemuApiClient } from '../services/api'
import { getWalletBalance, createCheckoutSession } from '../services/api/endpoints/wallet'
import { getAuthService } from '../services/auth'
import type { IpcResponse } from '../types'

// ============================================
// Types
// ============================================

interface WalletBalanceResult {
  balanceCents: number
  currency: string
}

interface CheckoutResult {
  checkoutUrl: string
  sessionId: string
}

// ============================================
// Handlers
// ============================================

export function registerBillingHandlers(): void {
  const apiClient = getMemuApiClient()
  const authService = getAuthService()

  // Get wallet balance
  ipcMain.handle('billing:getBalance', async (): Promise<IpcResponse<WalletBalanceResult>> => {
    try {
      const accessToken = await authService.getAccessToken()
      if (!accessToken) {
        return { success: false, error: 'Not authenticated' }
      }

      const { organizationId } = authService.getAuthState()
      if (!organizationId) {
        return { success: false, error: 'Organization ID not available' }
      }

      const result = await getWalletBalance(apiClient, accessToken, organizationId)

      return {
        success: true,
        data: {
          balanceCents: result.balance_cents,
          currency: result.currency
        }
      }
    } catch (error) {
      console.error('[BillingIPC] Failed to get balance:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get balance'
      }
    }
  })

  // Create checkout session for top-up
  ipcMain.handle(
    'billing:createCheckout',
    async (
      _event,
      amountCents: number
    ): Promise<IpcResponse<CheckoutResult>> => {
      try {
        const accessToken = await authService.getAccessToken()
        if (!accessToken) {
          return { success: false, error: 'Not authenticated' }
        }

        const { organizationId } = authService.getAuthState()
        if (!organizationId) {
          return { success: false, error: 'Organization ID not available' }
        }

        // Use Yumi-specific URLs for redirect
        const baseUrl = 'https://app.memu.so'
        const successUrl = `${baseUrl}/purchase-result?status=success&from=yumi`
        const cancelUrl = `${baseUrl}/purchase-result?status=error&from=yumi`

        const result = await createCheckoutSession(
          apiClient,
          accessToken,
          {
            amount_cents: amountCents,
            success_url: successUrl,
            cancel_url: cancelUrl,
            allow_promotion_codes: false
          },
          organizationId
        )

        return {
          success: true,
          data: {
            checkoutUrl: result.checkout_url,
            sessionId: result.session_id
          }
        }
      } catch (error) {
        console.error('[BillingIPC] Failed to create checkout:', error)
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to create checkout'
        }
      }
    }
  )

  // Open checkout URL in browser
  ipcMain.handle('billing:openCheckout', async (_event, url: string): Promise<IpcResponse> => {
    try {
      await shell.openExternal(url)
      return { success: true }
    } catch (error) {
      console.error('[BillingIPC] Failed to open checkout URL:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to open checkout'
      }
    }
  })

  console.log('[IPC] Billing handlers registered')
}
