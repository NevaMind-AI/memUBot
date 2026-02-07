import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { User, Mail, Lock, LogIn, LogOut, Loader2, Globe, MessageCircle, RefreshCw, Wallet, CreditCard } from 'lucide-react'
import { MessageDisplay } from './shared'
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
  
  // Login form state
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

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
              <div className="flex items-center gap-4 mb-4">
                <div className="w-14 h-14 rounded-full bg-[var(--primary-bg)] flex items-center justify-center overflow-hidden">
                  {userInfo.photoURL ? (
                    <img src={userInfo.photoURL} alt="" className="w-14 h-14 rounded-full object-cover" />
                  ) : (
                    <User className="w-7 h-7 text-[var(--primary)]" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-[15px] font-medium text-[var(--text-primary)] truncate">
                    {userInfo.displayName || 'Yumi User'}
                  </h4>
                  <p className="text-[12px] text-[var(--text-muted)] truncate">
                    {userInfo.email || t('settings.account.noEmail')}
                  </p>
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
          // Login form
          <div className="p-4 rounded-2xl bg-[var(--glass-bg)] backdrop-blur-xl border border-[var(--glass-border)] shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-[var(--primary-bg)] flex items-center justify-center">
                <User className="w-5 h-5 text-[var(--primary)]" />
              </div>
              <div>
                <h4 className="text-[13px] font-medium text-[var(--text-primary)]">{t('settings.account.login')}</h4>
                <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                  {t('settings.account.loginHint')}
                </p>
              </div>
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
                  onKeyDown={(e) => e.key === 'Enter' && !loading && handleLogin()}
                  disabled={loading}
                  className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)] text-[13px] text-[var(--text-primary)] placeholder-[var(--text-placeholder)] focus:outline-none focus:border-[var(--primary)]/50 focus:ring-2 focus:ring-[var(--primary)]/10 transition-all disabled:opacity-50"
                />
              </div>

              {/* Login Button */}
              <button
                onClick={handleLogin}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 mt-3 px-4 py-3 rounded-xl text-white text-[13px] font-medium shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: 'var(--primary-gradient)', boxShadow: 'var(--shadow-primary)' }}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{t('settings.account.loggingIn')}</span>
                  </>
                ) : (
                  <>
                    <LogIn className="w-4 h-4" />
                    <span>{t('settings.account.login')}</span>
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
  const [balance, setBalance] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [topUpLoading, setTopUpLoading] = useState(false)

  useEffect(() => {
    // TODO: Fetch balance from API
    const fetchBalance = async () => {
      setLoading(true)
      try {
        // Placeholder: simulate API call
        await new Promise(resolve => setTimeout(resolve, 500))
        setBalance(0) // Default to 0 for new users
      } catch (error) {
        console.error('Failed to fetch balance:', error)
        setBalance(null)
      } finally {
        setLoading(false)
      }
    }

    fetchBalance()
  }, [])

  const handleTopUp = async () => {
    setTopUpLoading(true)
    try {
      // TODO: Integrate with Stripe checkout
      // const result = await window.billing.createCheckoutSession()
      // if (result.url) {
      //   window.open(result.url, '_blank')
      // }
      console.log('TODO: Implement Stripe checkout')
      // For now, just show a placeholder message
      alert(t('settings.account.topUpComingSoon'))
    } catch (error) {
      console.error('Failed to initiate top-up:', error)
    } finally {
      setTopUpLoading(false)
    }
  }

  const formatBalance = (amount: number | null): string => {
    if (amount === null) return '--'
    return `$${amount.toFixed(2)}`
  }

  return (
    <div className="p-4 rounded-2xl bg-[var(--glass-bg)] backdrop-blur-xl border border-[var(--glass-border)] shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
            <Wallet className="w-5 h-5 text-emerald-500" />
          </div>
          <div>
            <h4 className="text-[13px] font-medium text-[var(--text-primary)]">
              {t('settings.account.balance')}
            </h4>
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
              {formatBalance(balance)}
            </span>
          )}
        </div>
      </div>

      <button
        onClick={handleTopUp}
        disabled={topUpLoading || loading}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-white text-[13px] font-medium shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}
      >
        {topUpLoading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>{t('settings.account.processing')}</span>
          </>
        ) : (
          <>
            <CreditCard className="w-4 h-4" />
            <span>{t('settings.account.topUp')}</span>
          </>
        )}
      </button>
    </div>
  )
}
