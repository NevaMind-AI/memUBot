import { useState, useEffect } from 'react'
import { Power, Loader2, Circle, Users, Square, Brain, Wrench, Bot, MessageCircle } from 'lucide-react'
import { toast } from '../Toast'
import { BoundUsersModal } from '../Telegram/BoundUsersModal'

interface HeaderProps {
  title: string
  subtitle?: string
  showTelegramStatus?: boolean
}

// Telegram bot avatar component
function BotAvatar({
  isConnected,
  avatarUrl
}: {
  isConnected: boolean
  avatarUrl?: string
}): JSX.Element {
  // If we have an avatar URL and connected, show the actual avatar
  if (isConnected && avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt="Bot Avatar"
        className="w-9 h-9 rounded-full object-cover border-2 border-[#7DCBF7]"
      />
    )
  }

  // Default avatar icons
  return (
    <div
      className={`w-9 h-9 rounded-full flex items-center justify-center ${
        isConnected
          ? 'bg-gradient-to-br from-[#7DCBF7] to-[#2596D1]'
          : 'bg-[var(--bg-card)] border border-[var(--border-color)]'
      }`}
    >
      {isConnected ? (
        <Bot className="w-5 h-5 text-white" />
      ) : (
        <MessageCircle className="w-5 h-5 text-[var(--text-muted)]" />
      )}
    </div>
  )
}

interface BotStatus {
  platform: string
  isConnected: boolean
  username?: string
  botName?: string
  avatarUrl?: string
  error?: string
}

interface LLMStatusInfo {
  status: 'idle' | 'thinking' | 'tool_executing'
  currentTool?: string
  iteration?: number
}

export function Header({ title, subtitle, showTelegramStatus }: HeaderProps): JSX.Element {
  const [status, setStatus] = useState<BotStatus | null>(null)
  const [connecting, setConnecting] = useState(false)
  const [showBoundUsers, setShowBoundUsers] = useState(false)
  const [llmStatus, setLLMStatus] = useState<LLMStatusInfo>({ status: 'idle' })

  // Subscribe to LLM status changes
  useEffect(() => {
    const unsubscribe = window.llm.onStatusChanged((newStatus: LLMStatusInfo) => {
      setLLMStatus(newStatus)
    })
    // Get initial status
    window.llm.getStatus().then(setLLMStatus)
    return () => unsubscribe()
  }, [])

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

  const handleAbortLLM = async () => {
    try {
      await window.llm.abort()
      toast.info('Processing stopped')
    } catch (error) {
      console.error('Failed to abort LLM:', error)
    }
  }

  const isConnected = status?.isConnected
  const isLLMProcessing = llmStatus.status !== 'idle'

  // Get display info based on connection status
  const displayName = showTelegramStatus
    ? isConnected
      ? status?.botName || status?.username || 'Bot'
      : 'Telegram'
    : title
  const displaySubtitle = showTelegramStatus
    ? isConnected
      ? `@${status?.username}`
      : 'AI Assistant'
    : subtitle
  const avatarUrl = status?.avatarUrl

  return (
    <header className="h-14 flex items-center justify-between px-5 bg-[var(--glass-bg)] backdrop-blur-xl border-b border-[var(--glass-border)]">
      {/* Title with Avatar */}
      <div className="flex items-center gap-3">
        {/* Avatar - only for Telegram */}
        {showTelegramStatus && <BotAvatar isConnected={!!isConnected} avatarUrl={avatarUrl} />}

        {/* Title and Subtitle */}
        <div className="flex items-center gap-2">
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-[15px] font-semibold text-[var(--text-primary)] leading-tight">
                {displayName}
              </h1>
              {/* Connection status dot */}
              {showTelegramStatus && (
                <Circle
                  className={`w-2 h-2 ${isConnected ? 'fill-emerald-500 text-emerald-500' : 'fill-[var(--text-muted)] text-[var(--text-muted)]'}`}
                />
              )}
            </div>
            {displaySubtitle && (
              <p className="text-[11px] text-[var(--text-muted)] leading-tight">{displaySubtitle}</p>
            )}
          </div>

          {/* Bound Users Button - only show for Telegram */}
          {showTelegramStatus && (
            <button
              onClick={() => setShowBoundUsers(true)}
              className="p-1.5 rounded-lg hover:bg-[var(--bg-card)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all"
              title="Bound Accounts"
            >
              <Users className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        {showTelegramStatus && (
          <>
            {/* LLM Status Indicator */}
            {isLLMProcessing && (
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 dark:bg-amber-500/20 backdrop-blur-sm border border-amber-500/30 whitespace-nowrap">
                  {llmStatus.status === 'thinking' ? (
                    <Brain className="w-3 h-3 text-amber-500 animate-pulse flex-shrink-0" />
                  ) : (
                    <Wrench className="w-3 h-3 text-amber-500 animate-pulse flex-shrink-0" />
                  )}
                  <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                    {llmStatus.status === 'thinking'
                      ? `Thinking${llmStatus.iteration ? ` (${llmStatus.iteration})` : ''}...`
                      : llmStatus.currentTool || 'Executing...'}
                  </span>
                </div>
                {/* Stop Button */}
                <button
                  onClick={handleAbortLLM}
                  className="p-1 rounded-md bg-red-500/10 dark:bg-red-500/20 border border-red-500/30 text-red-600 dark:text-red-400 hover:bg-red-500/20 transition-all flex-shrink-0"
                  title="Stop processing"
                >
                  <Square className="w-3 h-3 fill-current" />
                </button>
              </div>
            )}

            {/* Connect/Disconnect Button */}
            <button
              onClick={isConnected ? handleDisconnect : handleConnect}
              disabled={connecting}
              title={connecting ? 'Connecting...' : isConnected ? 'Disconnect' : 'Connect'}
              className={`p-2 rounded-lg transition-all duration-200 ${
                isConnected
                  ? 'bg-red-500/10 dark:bg-red-500/20 backdrop-blur-sm border border-red-500/20 text-red-600 dark:text-red-400 hover:bg-red-500/20 hover:shadow-md'
                  : 'bg-gradient-to-r from-[#7DCBF7] to-[#2596D1] text-white shadow-lg shadow-[#2596D1]/25 hover:shadow-xl hover:shadow-[#2596D1]/30'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {connecting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Power className="w-4 h-4" />
              )}
            </button>
          </>
        )}
      </div>

      {/* Bound Users Modal */}
      {showTelegramStatus && (
        <BoundUsersModal isOpen={showBoundUsers} onClose={() => setShowBoundUsers(false)} />
      )}
    </header>
  )
}
