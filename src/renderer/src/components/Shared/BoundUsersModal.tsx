import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { X, User, Trash2, Loader2, Shield, AlertTriangle } from 'lucide-react'
import { toast } from '../../stores/toastStore'

interface BoundUser {
  uniqueId: string
  userId: number
  username: string
  firstName?: string
  lastName?: string
  boundAt: number
}

type Platform = 'telegram' | 'discord' | 'slack'

interface BoundUsersModalProps {
  isOpen: boolean
  onClose: () => void
  platform?: Platform
}

// Platform-specific colors (with dark mode variants)
const platformColors: Record<Platform, { from: string; to: string; accent: string; darkAccent: string }> = {
  telegram: { from: '#7DCBF7', to: '#2596D1', accent: '#2596D1', darkAccent: '#7DCBF7' },
  discord: { from: '#5865F2', to: '#7289DA', accent: '#5865F2', darkAccent: '#a5b4fc' },
  slack: { from: '#E0B3E6', to: '#C97BD2', accent: '#611F69', darkAccent: '#E0B3E6' }
}

// Platform-specific bind commands
const platformBindCommands: Record<Platform, string> = {
  telegram: '/bind <code>',
  discord: '@bot /bind <code>',
  slack: '/bind <code>'
}

// Capitalized platform names
const platformNames: Record<Platform, string> = {
  telegram: 'Telegram',
  discord: 'Discord',
  slack: 'Slack'
}

/**
 * Shared Bound Users Modal
 * Displays bound accounts for any messaging platform with platform-specific theming
 */
export function BoundUsersModal({ isOpen, onClose, platform = 'telegram' }: BoundUsersModalProps): JSX.Element | null {
  const [users, setUsers] = useState<BoundUser[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [shouldRender, setShouldRender] = useState(false)
  const [isAnimatingIn, setIsAnimatingIn] = useState(false)

  const colors = platformColors[platform]
  const bindCommand = platformBindCommands[platform]
  const platformName = platformNames[platform]
  
  // Discord and Slack use string IDs, Telegram uses numeric IDs
  const usesStringId = platform === 'discord' || platform === 'slack'
  
  // Check if dark mode is active
  const [isDarkMode, setIsDarkMode] = useState(() => 
    document.documentElement.classList.contains('dark')
  )
  
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDarkMode(document.documentElement.classList.contains('dark'))
    })
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])
  
  // Use appropriate accent color based on theme
  const accentColor = isDarkMode ? colors.darkAccent : colors.accent

  // Handle mount/unmount with animation
  useEffect(() => {
    if (isOpen) {
      setShouldRender(true)
      // Trigger enter animation after mount
      const timer = setTimeout(() => setIsAnimatingIn(true), 10)
      return () => clearTimeout(timer)
    } else {
      // Trigger exit animation
      setIsAnimatingIn(false)
      // Unmount after animation
      const timer = setTimeout(() => setShouldRender(false), 200)
      return () => clearTimeout(timer)
    }
  }, [isOpen])

  useEffect(() => {
    if (isOpen) {
      loadBoundUsers()
    }
  }, [isOpen])

  const loadBoundUsers = async () => {
    setLoading(true)
    try {
      // Get bound users for the current platform
      const result = await window.security.getBoundUsers(platform)
      if (result.success && result.data) {
        setUsers(result.data)
      }
    } catch (error) {
      console.error('Failed to load bound users:', error)
    }
    setLoading(false)
  }

  const handleRemoveUser = async (user: BoundUser) => {
    const identifier = user.uniqueId || String(user.userId)
    setDeletingId(identifier)
    try {
      // Use string ID removal for Discord/Slack, numeric ID for Telegram
      let result
      if (usesStringId) {
        result = await window.security.removeBoundUserById(identifier, platform)
      } else {
        result = await window.security.removeBoundUser(user.userId, platform)
      }
      
      if (result.success) {
        setUsers((prev) => prev.filter((u) => (u.uniqueId || String(u.userId)) !== identifier))
        toast.success(`Removed @${user.username}`)
      } else {
        toast.error(result.error || 'Failed to remove user')
      }
    } catch (error) {
      toast.error('Failed to remove user')
    }
    setDeletingId(null)
  }

  const formatDate = useCallback((timestamp: number): string => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }, [])

  if (!shouldRender) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-200 ${
          isAnimatingIn ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className={`relative w-full max-w-md mx-4 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden transition-all duration-200 ${
          isAnimatingIn ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: `linear-gradient(to bottom right, ${accentColor}20, ${accentColor}30)` }}
            >
              <Shield className="w-4 h-4" style={{ color: accentColor }} />
            </div>
            <h2 className="text-[15px] font-semibold text-slate-900 dark:text-white">
              {platformName} Bound Accounts
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 max-h-[400px] overflow-y-auto bg-white dark:bg-slate-900">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin" style={{ color: accentColor }} />
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-6">
              <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
              <p className="text-[13px] text-slate-900 dark:text-white font-medium">
                No bound accounts yet
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 mb-4">
                Bind your {platformName} account to use this bot
              </p>

              {/* Binding Instructions */}
              <div className="text-left p-4 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <h4 className="text-[12px] font-medium text-slate-900 dark:text-white mb-2">
                  How to bind ({platformName})
                </h4>
                <ol className="space-y-1.5 text-[11px] text-slate-600 dark:text-slate-400">
                  <li className="flex items-start gap-2">
                    <span
                      className="flex-shrink-0 w-4 h-4 rounded-full text-[10px] font-medium flex items-center justify-center"
                      style={{ background: `${accentColor}20`, color: accentColor }}
                    >
                      1
                    </span>
                    <span>Go to Settings → Security</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span
                      className="flex-shrink-0 w-4 h-4 rounded-full text-[10px] font-medium flex items-center justify-center"
                      style={{ background: `${accentColor}20`, color: accentColor }}
                    >
                      2
                    </span>
                    <span>Generate a security code</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span
                      className="flex-shrink-0 w-4 h-4 rounded-full text-[10px] font-medium flex items-center justify-center"
                      style={{ background: `${accentColor}20`, color: accentColor }}
                    >
                      3
                    </span>
                    <span>
                      Send{' '}
                      <code className="px-1 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-[10px] text-slate-700 dark:text-slate-300">
                        {bindCommand}
                      </code>{' '}
                      to your bot
                    </span>
                  </li>
                </ol>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {users.map((user) => (
                <div
                  key={user.uniqueId || String(user.userId)}
                  className="flex items-center justify-between p-3 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center"
                      style={{ background: `linear-gradient(to bottom right, ${accentColor}25, ${accentColor}35)` }}
                    >
                      <User className="w-5 h-5" style={{ color: accentColor }} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-medium text-slate-900 dark:text-white">
                          {user.firstName || user.username}
                        </span>
                        {user.username && (
                          <span className="text-[12px] text-slate-500 dark:text-slate-400">
                            @{user.username}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Bound {formatDate(user.boundAt)}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemoveUser(user)}
                    disabled={deletingId === (user.uniqueId || String(user.userId))}
                    className="p-2 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/20 transition-all disabled:opacity-50"
                  >
                    {deletingId === (user.uniqueId || String(user.userId)) ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </div>
              ))}

              {/* Binding Instructions for existing users */}
              <div className="mt-4 p-3 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  <strong className="text-slate-700 dark:text-slate-300">Add more accounts:</strong>{' '}
                  Go to Settings → Security to generate a new binding code
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {users.length > 0 && (
          <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
            <p className="text-[11px] text-slate-500 dark:text-slate-400 text-center">
              {users.length} account{users.length > 1 ? 's' : ''} can access this bot
            </p>
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
