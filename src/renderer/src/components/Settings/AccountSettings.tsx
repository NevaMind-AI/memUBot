import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { User, Mail, Lock, LogIn, LogOut, Loader2, Globe, MessageCircle, RefreshCw, Wallet, CreditCard, UserPlus, Tag, Check } from 'lucide-react'
import { MessageDisplay } from './shared'
import { ChargeDialog } from './ChargeDialog'
import { changeLanguage, languages } from '../../i18n'
import { useEasemobStore } from '../../stores/easemobStore'
import { reconnectEasemob } from '../../services/easemob/autoConnect'

interface UserInfo {
  uid: string
  email: string | null
  displayName: string | null
  photoURL: string | null
}

export function AccountSettings(): JSX.Element {
  const { t } = useTranslation()
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null)
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const { connected, connecting, error } = useEasemobStore()
  
  // Auth form state
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  // Load initial auth state
  useEffect(() => {
    const loadAuthState = async () => {
      try {
        const state = await window.auth.getState()
        setIsLoggedIn(state.isLoggedIn)
        setUserInfo(state.user)
      } catch (error) {
        console.error('Failed to load auth state:', error)
      } finally {
        setInitialLoading(false)
      }
    }

    loadAuthState()

    // Subscribe to auth state changes
    const unsubscribe = window.auth.onStateChanged((state) => {
      setIsLoggedIn(state.isLoggedIn)
      setUserInfo(state.user as UserInfo | null)
    })

    return unsubscribe
  }, [])

  const handleLogin = async () => {
    if (!email || !password) {
      setMessage({ type: 'error', text: t('settings.account.fillAllFields') })
      return
    }

    setLoading(true)
    setMessage(null)

    try {
      const result = await window.auth.signInWithEmail(email, password)
      
      if (result.success && result.user) {
        setUserInfo(result.user)
        setIsLoggedIn(true)
        setEmail('')
        setPassword('')
        setMessage({ type: 'success', text: t('settings.account.loginSuccess') })
        setTimeout(() => setMessage(null), 3000)
      } else {
        setMessage({ type: 'error', text: result.error || t('settings.account.loginError') })
      }
    } catch (error) {
      setMessage({ type: 'error', text: t('settings.account.loginError') })
    } finally {
      setLoading(false)
    }
  }

  const handleRegister = async () => {
    if (!email || !password || !confirmPassword) {
      setMessage({ type: 'error', text: t('settings.account.fillAllFields') })
      return
    }

    if (password !== confirmPassword) {
      setMessage({ type: 'error', text: t('settings.account.passwordMismatch') })
      return
    }

    if (password.length < 6) {
      setMessage({ type: 'error', text: t('settings.account.passwordTooShort') })
      return
    }

    setLoading(true)
    setMessage(null)

    try {
      const result = await window.auth.signUpWithEmail(email, password)
      
      if (result.success && result.user) {
        setUserInfo(result.user)
        setIsLoggedIn(true)
        setEmail('')
        setPassword('')
        setConfirmPassword('')
        setMessage({ type: 'success', text: t('settings.account.registerSuccess') })
        setTimeout(() => setMessage(null), 3000)
      } else {
        setMessage({ type: 'error', text: result.error || t('settings.account.registerError') })
      }
    } catch (error) {
      setMessage({ type: 'error', text: t('settings.account.registerError') })
    } finally {
      setLoading(false)
    }
  }

  const handleForgotPassword = async () => {
    if (!email) {
      setMessage({ type: 'error', text: t('settings.account.enterEmailFirst') })
      return
    }

    setLoading(true)
    setMessage(null)

    try {
      const result = await window.auth.resetPassword(email)
      
      if (result.success) {
        setMessage({ type: 'success', text: t('settings.account.resetEmailSent') })
        setTimeout(() => setMessage(null), 5000)
      } else {
        setMessage({ type: 'error', text: result.error || t('settings.account.resetEmailError') })
      }
    } catch (error) {
      setMessage({ type: 'error', text: t('settings.account.resetEmailError') })
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    setLoading(true)
    try {
      const result = await window.auth.signOut()
      
      if (result.success) {
        setUserInfo(null)
        setIsLoggedIn(false)
        setMessage({ type: 'success', text: t('settings.account.logoutSuccess') })
        setTimeout(() => setMessage(null), 3000)
      } else {
        setMessage({ type: 'error', text: result.error || t('settings.account.logoutError') })
      }
    } catch (error) {
      setMessage({ type: 'error', text: t('settings.account.logoutError') })
    } finally {
      setLoading(false)
    }
  }

  if (initialLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-[var(--text-muted)]" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-semibold text-[var(--text-primary)]">{t('settings.account.title')}</h3>
        <p className="text-[12px] text-[var(--text-muted)] mt-0.5">
          {t('settings.account.description')}
        </p>
      </div>

      <div className="space-y-3">
        {isLoggedIn && userInfo ? (
          // Logged in state
          <>
            {/* User Profile Card */}
            <div className="p-4 rounded-2xl bg-[var(--glass-bg)] backdrop-blur-xl border border-[var(--glass-border)] shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[var(--primary-bg)] flex items-center justify-center">
                    <Mail className="w-5 h-5 text-[var(--primary)]" />
                  </div>
                  <div>
                    <h4 className="text-[13px] font-medium text-[var(--text-primary)] truncate">
                      {userInfo.email || t('settings.account.noEmail')}
                    </h4>
                    <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                      {t('settings.account.loggedIn')}
                    </p>
                  </div>
                </div>
              </div>
              
              <button
                onClick={handleLogout}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)] text-[var(--text-secondary)] text-[13px] font-medium hover:bg-[var(--bg-card)] transition-all disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <LogOut className="w-4 h-4" />
                )}
                <span>{t('settings.account.logout')}</span>
              </button>
            </div>

            {/* Balance Card */}
            <BalanceCard />
          </>
        ) : (
          // Login/Register form
          <div className="p-4 rounded-2xl bg-[var(--glass-bg)] backdrop-blur-xl border border-[var(--glass-border)] shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[var(--primary-bg)] flex items-center justify-center">
                  {authMode === 'login' ? (
                    <User className="w-5 h-5 text-[var(--primary)]" />
                  ) : (
                    <UserPlus className="w-5 h-5 text-[var(--primary)]" />
                  )}
                </div>
                <div>
                  <h4 className="text-[13px] font-medium text-[var(--text-primary)]">
                    {authMode === 'login' ? t('settings.account.login') : t('settings.account.register')}
                  </h4>
                  <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                    {authMode === 'login' ? t('settings.account.loginHint') : t('settings.account.registerHint')}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setAuthMode(authMode === 'login' ? 'register' : 'login')
                  setMessage(null)
                  setConfirmPassword('')
                }}
                disabled={loading}
                className="text-[12px] text-[var(--primary)] hover:underline disabled:opacity-50"
              >
                {authMode === 'login' ? t('settings.account.switchToRegister') : t('settings.account.switchToLogin')}
              </button>
            </div>

            <div className="flex flex-col gap-1">
              {/* Email */}
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                <input
                  type="email"
                  placeholder={t('settings.account.emailPlaceholder')}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)] text-[13px] text-[var(--text-primary)] placeholder-[var(--text-placeholder)] focus:outline-none focus:border-[var(--primary)]/50 focus:ring-2 focus:ring-[var(--primary)]/10 transition-all disabled:opacity-50"
                />
              </div>

              {/* Password */}
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                <input
                  type="password"
                  placeholder={t('settings.account.passwordPlaceholder')}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !loading && authMode === 'login' && handleLogin()}
                  disabled={loading}
                  className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)] text-[13px] text-[var(--text-primary)] placeholder-[var(--text-placeholder)] focus:outline-none focus:border-[var(--primary)]/50 focus:ring-2 focus:ring-[var(--primary)]/10 transition-all disabled:opacity-50"
                />
              </div>

              {/* Confirm Password (Register only) */}
              {authMode === 'register' && (
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                  <input
                    type="password"
                    placeholder={t('settings.account.confirmPasswordPlaceholder')}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !loading && handleRegister()}
                    disabled={loading}
                    className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)] text-[13px] text-[var(--text-primary)] placeholder-[var(--text-placeholder)] focus:outline-none focus:border-[var(--primary)]/50 focus:ring-2 focus:ring-[var(--primary)]/10 transition-all disabled:opacity-50"
                  />
                </div>
              )}

              {/* Forgot Password (Login only) */}
              {authMode === 'login' && (
                <div className="text-right">
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    disabled={loading}
                    className="text-[11px] text-[var(--text-muted)] hover:text-[var(--primary)] hover:underline disabled:opacity-50 transition-colors"
                  >
                    {t('settings.account.forgotPassword')}
                  </button>
                </div>
              )}

              {/* Submit Button */}
              <button
                onClick={authMode === 'login' ? handleLogin : handleRegister}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 mt-3 px-4 py-3 rounded-xl text-white text-[13px] font-medium shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: 'var(--primary-gradient)', boxShadow: 'var(--shadow-primary)' }}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{authMode === 'login' ? t('settings.account.loggingIn') : t('settings.account.registering')}</span>
                  </>
                ) : (
                  <>
                    {authMode === 'login' ? <LogIn className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                    <span>{authMode === 'login' ? t('settings.account.login') : t('settings.account.register')}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Language Selector */}
        <LanguageSelector />

        {/* IM Status */}
        <IMStatusCard connected={connected} connecting={connecting} error={error} />
      </div>

      {/* Message */}
      <MessageDisplay message={message} />
    </div>
  )
}

/**
 * Language Selector Component
 */
function LanguageSelector(): JSX.Element {
  const { t, i18n } = useTranslation()
  const currentLang = i18n.language

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newLang = e.target.value
    changeLanguage(newLang)
  }

  return (
    <div className="p-4 rounded-2xl bg-[var(--glass-bg)] backdrop-blur-xl border border-[var(--glass-border)] shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[var(--primary-bg)] flex items-center justify-center">
            <Globe className="w-5 h-5 text-[var(--primary)]" />
          </div>
          <div>
            <h4 className="text-[13px] font-medium text-[var(--text-primary)]">
              {t('settings.general.language')}
            </h4>
            <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
              {t('settings.general.languageHint')}
            </p>
          </div>
        </div>
        <select
          value={currentLang}
          onChange={handleLanguageChange}
          className="w-auto min-w-[120px] px-3 py-2 rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)] text-[13px] text-[var(--text-primary)] focus:outline-none focus:border-[var(--primary)]/50"
        >
          {languages.map((lang) => (
            <option key={lang.code} value={lang.code}>
              {lang.nativeName}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}

/**
 * IM Status Card with reconnect button
 */
function IMStatusCard({
  connected,
  connecting,
  error
}: {
  connected: boolean
  connecting: boolean
  error: string | null
}): JSX.Element {
  const { t } = useTranslation()
  const [reconnecting, setReconnecting] = useState(false)

  const handleReconnect = async (): Promise<void> => {
    setReconnecting(true)
    try {
      await reconnectEasemob()
    } finally {
      setReconnecting(false)
    }
  }

  const isLoading = connecting || reconnecting

  return (
    <div className="p-4 rounded-2xl bg-[var(--glass-bg)] backdrop-blur-xl border border-[var(--glass-border)] shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[var(--primary-bg)] flex items-center justify-center">
            <MessageCircle className="w-5 h-5 text-[var(--primary)]" />
          </div>
          <div>
            <h4 className="text-[13px] font-medium text-[var(--text-primary)]">
              {t('settings.account.imStatus')}
            </h4>
            <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
              {t('settings.account.imStatusHint')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full ${
              isLoading ? 'bg-amber-400' : connected ? 'bg-emerald-400' : 'bg-gray-400'
            }`}
          />
          <span className="text-[12px] text-[var(--text-secondary)]">
            {isLoading
              ? t('common.connecting')
              : connected
                ? t('common.connected')
                : t('common.disconnected')}
          </span>
          {!isLoading && (
            <button
              onClick={handleReconnect}
              className="ml-1 p-1.5 rounded-lg hover:bg-[var(--bg-input)] transition-colors text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
              title={t('common.reconnect', 'Reconnect')}
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          )}
          {isLoading && (
            <Loader2 className="ml-1 w-3.5 h-3.5 animate-spin text-amber-400" />
          )}
        </div>
      </div>
      {error && (
        <p className="text-[11px] text-rose-500 mt-2">
          {error}
        </p>
      )}
    </div>
  )
}

/**
 * Balance Card with top-up button
 */
function BalanceCard(): JSX.Element {
  const { t } = useTranslation()
  const [balanceCents, setBalanceCents] = useState<number | null>(null)
  const [currency, setCurrency] = useState<string>('USD')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [chargeDialogOpen, setChargeDialogOpen] = useState(false)

  const fetchBalance = async (isRefresh = false): Promise<void> => {
    if (isRefresh) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }
    try {
      const result = await window.billing.getBalance()
      if (result.success && result.data) {
        setBalanceCents(result.data.balanceCents)
        setCurrency(result.data.currency)
      } else {
        console.error('Failed to fetch balance:', result.error)
        setBalanceCents(null)
      }
    } catch (error) {
      console.error('Failed to fetch balance:', error)
      setBalanceCents(null)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  // Initial load
  useEffect(() => {
    fetchBalance()
  }, [])

  // Refresh balance when app comes to foreground
  useEffect(() => {
    const handleVisibilityChange = (): void => {
      if (document.visibilityState === 'visible') {
        fetchBalance(true)
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  const handleTopUp = async (amountCents: number): Promise<void> => {
    const result = await window.billing.createCheckout(amountCents)
    if (result.success && result.data?.checkoutUrl) {
      // Open checkout URL in browser
      await window.billing.openCheckout(result.data.checkoutUrl)
    } else {
      throw new Error(result.error || 'Failed to create checkout session')
    }
  }

  const formatCents = (cents: number | null, curr: string): string => {
    if (cents === null) return '--'
    const symbol = curr === 'USD' ? '$' : curr
    const amount = cents / 100
    if (amount < 0.01 && cents > 0) {
      return `< ${symbol} 0.01`
    }
    return `${symbol} ${amount.toFixed(2)}`
  }

  return (
    <>
      <div className="p-4 rounded-2xl bg-[var(--glass-bg)] backdrop-blur-xl border border-[var(--glass-border)] shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <Wallet className="w-5 h-5 text-emerald-500" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h4 className="text-[13px] font-medium text-[var(--text-primary)]">
                  {t('settings.account.balance')}
                </h4>
                <button
                  onClick={() => fetchBalance(true)}
                  disabled={refreshing || loading}
                  className="p-1 rounded-md hover:bg-[var(--bg-input)] transition-colors text-[var(--text-muted)] hover:text-[var(--text-secondary)] disabled:opacity-50"
                  title={t('common.refresh', 'Refresh')}
                >
                  <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
                </button>
              </div>
              <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                {t('settings.account.balanceHint')}
              </p>
            </div>
          </div>
          <div className="text-right">
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin text-[var(--text-muted)]" />
            ) : (
              <span className="text-[20px] font-semibold text-[var(--text-primary)]">
                {formatCents(balanceCents, currency)}
              </span>
            )}
          </div>
        </div>

        <button
          onClick={() => setChargeDialogOpen(true)}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-white text-[13px] font-medium shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}
        >
          <CreditCard className="w-4 h-4" />
          <span>{t('settings.account.topUp')}</span>
        </button>
      </div>

      {/* Coupon Section */}
      <CouponCard onSuccess={() => fetchBalance(true)} />

      <ChargeDialog
        open={chargeDialogOpen}
        onClose={() => setChargeDialogOpen(false)}
        onContinue={handleTopUp}
      />
    </>
  )
}

/**
 * Coupon Card - Input and redeem coupon codes
 */
function CouponCard({ onSuccess }: { onSuccess: () => void }): JSX.Element {
  const { t } = useTranslation()
  const [couponCode, setCouponCode] = useState('')
  const [redeeming, setRedeeming] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const handleRedeem = async (): Promise<void> => {
    const trimmedCode = couponCode.trim()
    if (!trimmedCode) {
      setMessage({ type: 'error', text: t('settings.account.couponEmpty') })
      return
    }

    setRedeeming(true)
    setMessage(null)

    try {
      const result = await window.billing.redeemCoupon(trimmedCode)
      if (result.success) {
        setMessage({ type: 'success', text: t('settings.account.couponSuccess') })
        setCouponCode('')
        onSuccess()
        setTimeout(() => setMessage(null), 3000)
      } else {
        setMessage({ type: 'error', text: result.error || t('settings.account.couponError') })
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : t('settings.account.couponError')
      })
    } finally {
      setRedeeming(false)
    }
  }

  return (
    <div className="p-4 rounded-2xl bg-[var(--glass-bg)] backdrop-blur-xl border border-[var(--glass-border)] shadow-sm">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
          <Tag className="w-5 h-5 text-amber-500" />
        </div>
        <div>
          <h4 className="text-[13px] font-medium text-[var(--text-primary)]">
            {t('settings.account.coupon')}
          </h4>
          <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
            {t('settings.account.couponHint')}
          </p>
        </div>
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          placeholder={t('settings.account.couponPlaceholder')}
          value={couponCode}
          onChange={(e) => setCouponCode(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !redeeming && handleRedeem()}
          disabled={redeeming}
          className="flex-1 px-3 py-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)] text-[13px] text-[var(--text-primary)] placeholder-[var(--text-placeholder)] focus:outline-none focus:border-[var(--primary)]/50 focus:ring-2 focus:ring-[var(--primary)]/10 transition-all disabled:opacity-50"
        />
        <button
          onClick={handleRedeem}
          disabled={redeeming || !couponCode.trim()}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-white text-[13px] font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
          style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' }}
        >
          {redeeming ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Check className="w-4 h-4" />
          )}
          <span>{redeeming ? t('settings.account.couponRedeeming') : t('settings.account.couponRedeem')}</span>
        </button>
      </div>

      {message && (
        <p
          className={`text-[11px] mt-2 ${
            message.type === 'success' ? 'text-emerald-500' : 'text-rose-500'
          }`}
        >
          {message.text}
        </p>
      )}
    </div>
  )
}
