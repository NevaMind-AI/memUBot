import { useState, useEffect } from 'react'
import { Power, Loader2, Circle } from 'lucide-react'
import { toast } from '../Toast'

interface HeaderProps {
  title: string
  subtitle?: string
  showTelegramStatus?: boolean
}

interface BotStatus {
  platform: string
  isConnected: boolean
  username?: string
  error?: string
}

export function Header({ title, subtitle, showTelegramStatus }: HeaderProps): JSX.Element {
  const [status, setStatus] = useState<BotStatus | null>(null)
  const [connecting, setConnecting] = useState(false)

  useEffect(() => {
    if (showTelegramStatus) {
      checkStatus()
      const unsubscribe = window.telegram.onStatusChanged((newStatus: BotStatus) => {
        setStatus(newStatus)
      })
      return () => unsubscribe()
    }
  }, [showTelegramStatus])

  const checkStatus = async () => {
    try {
      const result = await window.telegram.getStatus()
      if (result.success && result.data) {
        setStatus(result.data)
      }
    } catch (error) {
      console.error('Failed to get status:', error)
    }
  }

  const handleConnect = async () => {
    setConnecting(true)
    try {
      const result = await window.telegram.connect()
      if (!result.success) {
        setStatus({ platform: 'telegram', isConnected: false, error: result.error })
        toast.error(result.error || 'Failed to connect Telegram bot')
      } else {
        toast.success('Telegram bot connected successfully')
      }
      await checkStatus()
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Connection failed'
      setStatus({ platform: 'telegram', isConnected: false, error: errorMessage })
      toast.error(errorMessage)
    }
    setConnecting(false)
  }

  const handleDisconnect = async () => {
    try {
      await window.telegram.disconnect()
      toast.info('Telegram bot disconnected')
      await checkStatus()
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Disconnect failed'
      toast.error(errorMessage)
      console.error('Disconnect failed:', error)
    }
  }

  const isConnected = status?.isConnected

  return (
    <header className="h-14 flex items-center justify-between px-5 bg-[var(--glass-bg)] backdrop-blur-xl border-b border-[var(--glass-border)]">
      {/* Title */}
      <div className="flex items-center gap-2">
        <div>
          <h1 className="text-[15px] font-semibold text-[var(--text-primary)] leading-tight">
            {title}
          </h1>
          {subtitle && (
            <p className="text-[11px] text-[var(--text-muted)] leading-tight">{subtitle}</p>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        {showTelegramStatus && (
          <>
            {/* Status Indicator */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--bg-card)] backdrop-blur-sm border border-[var(--border-color)]">
              <Circle
                className={`w-2 h-2 ${isConnected ? 'fill-emerald-500 text-emerald-500' : 'fill-[var(--text-muted)] text-[var(--text-muted)]'}`}
              />
              <span className="text-[12px] text-[var(--text-secondary)] font-medium">
                {isConnected ? `@${status?.username}` : 'Offline'}
              </span>
            </div>

            {/* Connect/Disconnect Button */}
            <button
              onClick={isConnected ? handleDisconnect : handleConnect}
              disabled={connecting}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-medium transition-all duration-200 ${
                isConnected
                  ? 'bg-red-500/10 dark:bg-red-500/20 backdrop-blur-sm border border-red-500/20 text-red-600 dark:text-red-400 hover:bg-red-500/20 hover:shadow-md'
                  : 'bg-gradient-to-r from-[#7DCBF7] to-[#2596D1] text-white shadow-lg shadow-[#2596D1]/25 hover:shadow-xl hover:shadow-[#2596D1]/30'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {connecting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Connecting...</span>
                </>
              ) : isConnected ? (
                <>
                  <Power className="w-3.5 h-3.5" />
                  <span>Disconnect</span>
                </>
              ) : (
                <>
                  <Power className="w-3.5 h-3.5" />
                  <span>Connect</span>
                </>
              )}
            </button>
          </>
        )}
      </div>
    </header>
  )
}
