import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { User, Mail, Lock, LogIn, LogOut, Loader2 } from 'lucide-react'
import { MessageDisplay } from './shared'

interface UserInfo {
  email: string
  name?: string
  avatar?: string
}

export function AccountSettings(): JSX.Element {
  const { t } = useTranslation()
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  
  // Login form state
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const handleLogin = async () => {
    if (!email || !password) {
      setMessage({ type: 'error', text: t('settings.account.fillAllFields') })
      return
    }

    setLoading(true)
    setMessage(null)

    try {
      // TODO: Implement actual login API call
      // For now, simulate a login
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      setUserInfo({ email, name: email.split('@')[0] })
      setIsLoggedIn(true)
      setEmail('')
      setPassword('')
      setMessage({ type: 'success', text: t('settings.account.loginSuccess') })
      setTimeout(() => setMessage(null), 3000)
    } catch (error) {
      setMessage({ type: 'error', text: t('settings.account.loginError') })
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    setLoading(true)
    try {
      // TODO: Implement actual logout API call
      await new Promise(resolve => setTimeout(resolve, 500))
      
      setUserInfo(null)
      setIsLoggedIn(false)
      setMessage({ type: 'success', text: t('settings.account.logoutSuccess') })
      setTimeout(() => setMessage(null), 3000)
    } catch (error) {
      setMessage({ type: 'error', text: t('settings.account.logoutError') })
    } finally {
      setLoading(false)
    }
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
          <div className="p-4 rounded-2xl bg-[var(--glass-bg)] backdrop-blur-xl border border-[var(--glass-border)] shadow-sm">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-14 h-14 rounded-full bg-[var(--primary-bg)] flex items-center justify-center">
                {userInfo.avatar ? (
                  <img src={userInfo.avatar} alt="" className="w-14 h-14 rounded-full" />
                ) : (
                  <User className="w-7 h-7 text-[var(--primary)]" />
                )}
              </div>
              <div className="flex-1">
                <h4 className="text-[15px] font-medium text-[var(--text-primary)]">
                  {userInfo.name || userInfo.email}
                </h4>
                <p className="text-[12px] text-[var(--text-muted)]">{userInfo.email}</p>
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

            <div className="space-y-3">
              {/* Email */}
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                <input
                  type="email"
                  placeholder={t('settings.account.emailPlaceholder')}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)] text-[13px] text-[var(--text-primary)] placeholder-[var(--text-placeholder)] focus:outline-none focus:border-[var(--primary)]/50 focus:ring-2 focus:ring-[var(--primary)]/10 transition-all"
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
                  onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                  className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)] text-[13px] text-[var(--text-primary)] placeholder-[var(--text-placeholder)] focus:outline-none focus:border-[var(--primary)]/50 focus:ring-2 focus:ring-[var(--primary)]/10 transition-all"
                />
              </div>

              {/* Login Button */}
              <button
                onClick={handleLogin}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-white text-[13px] font-medium shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
      </div>

      {/* Message */}
      <MessageDisplay message={message} />
    </div>
  )
}
