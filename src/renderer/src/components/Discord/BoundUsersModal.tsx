import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, User, Trash2 } from 'lucide-react'

interface BoundUser {
  platform: string
  uniqueId: string
  userId: number
  username: string
  firstName?: string
  lastName?: string
  boundAt: number
}

interface BoundUsersModalProps {
  isOpen: boolean
  onClose: () => void
}

/**
 * Discord Bound Users Modal - Shows bound accounts with Discord purple theme
 */
export function DiscordBoundUsersModal({ isOpen, onClose }: BoundUsersModalProps): JSX.Element | null {
  const [boundUsers, setBoundUsers] = useState<BoundUser[]>([])
  const [loading, setLoading] = useState(true)
  const [shouldRender, setShouldRender] = useState(false)
  const [isAnimatingIn, setIsAnimatingIn] = useState(false)

  // Handle mount/unmount with animation
  useEffect(() => {
    if (isOpen) {
      setShouldRender(true)
      // Small delay to trigger animation
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsAnimatingIn(true)
        })
      })
    } else {
      setIsAnimatingIn(false)
      // Wait for animation to complete before unmounting
      const timer = setTimeout(() => {
        setShouldRender(false)
      }, 200)
      return () => clearTimeout(timer)
    }
  }, [isOpen])

  // Load bound users
  useEffect(() => {
    if (isOpen) {
      loadBoundUsers()
    }
  }, [isOpen])

  const loadBoundUsers = async () => {
    setLoading(true)
    try {
      // Get only Discord bound users
      const result = await window.security.getBoundUsers('discord')
      if (result.success && result.data) {
        setBoundUsers(result.data)
      }
    } catch (error) {
      console.error('Failed to load bound users:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleRemoveUser = async (userId: number, uniqueId?: string) => {
    try {
      // Use uniqueId if available (Discord IDs are strings), otherwise fall back to userId
      const result = uniqueId
        ? await window.security.removeBoundUserById(uniqueId, 'discord')
        : await window.security.removeBoundUser(userId, 'discord')
      if (result.success) {
        setBoundUsers((prev) =>
          prev.filter((u) => (uniqueId ? u.uniqueId !== uniqueId : u.userId !== userId))
        )
      }
    } catch (error) {
      console.error('Failed to remove user:', error)
    }
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  if (!shouldRender) return null

  const modalContent = (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-all duration-200 ${
        isAnimatingIn ? 'bg-black/30 backdrop-blur-md' : 'bg-transparent'
      }`}
      onClick={onClose}
    >
      <div
        className={`bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-[#5865F2]/30 transition-all duration-200 ${
          isAnimatingIn ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-[#5865F2]/10 to-[#7289DA]/10">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Bound Accounts</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[#5865F2]/20 text-slate-500 dark:text-slate-400 hover:text-[#5865F2] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 max-h-[400px] overflow-y-auto">
          {loading ? (
            <div className="text-center py-8 text-slate-500 dark:text-slate-400">Loading...</div>
          ) : boundUsers.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 rounded-full bg-[#5865F2]/20 flex items-center justify-center mx-auto mb-3">
                <User className="w-6 h-6 text-[#5865F2]" />
              </div>
              <p className="text-slate-500 dark:text-slate-400 text-sm">No accounts bound yet</p>
              <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg text-left">
                <p className="text-xs text-slate-600 dark:text-slate-300 font-medium mb-2">
                  How to bind your Discord account:
                </p>
                <ol className="text-xs text-slate-500 dark:text-slate-400 space-y-1 list-decimal list-inside">
                  <li>Go to Settings → Security</li>
                  <li>Generate a security code</li>
                  <li>
                    In Discord, send: <code className="text-[#5865F2]">/bind &lt;code&gt;</code>
                  </li>
                </ol>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {boundUsers.map((user) => (
                <div
                  key={user.userId}
                  className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#5865F2] to-[#7289DA] flex items-center justify-center">
                      <User className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900 dark:text-white">
                        {user.firstName || user.username}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        @{user.username} • Bound {formatDate(user.boundAt)}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemoveUser(user.userId, user.uniqueId)}
                    className="p-2 rounded-lg hover:bg-red-500/10 text-slate-400 hover:text-red-500 transition-colors"
                    title="Remove"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/30">
          <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
            Only bound accounts can @mention the bot to chat
          </p>
        </div>
      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
}
