import { useState, useEffect } from 'react'
import { Power, Loader2, Circle, Users, Square, Brain, Wrench, Bot, MessageCircle, Gamepad2 } from 'lucide-react'
import { toast } from '../Toast'
import { BoundUsersModal } from '../Telegram/BoundUsersModal'
import { DiscordBoundUsersModal } from '../Discord/BoundUsersModal'

interface HeaderProps {
  title: string
  subtitle?: string
  showTelegramStatus?: boolean
  showDiscordStatus?: boolean
}

// Bot avatar component - supports both Telegram and Discord themes
function BotAvatar({
  isConnected,
  avatarUrl,
  platform
}: {
  isConnected: boolean
  avatarUrl?: string
  platform: 'telegram' | 'discord'
}): JSX.Element {
  const colors = platform === 'discord'
    ? { from: '#5865F2', to: '#7289DA', border: '#5865F2' }
    : { from: '#7DCBF7', to: '#2596D1', border: '#7DCBF7' }

  // If we have an avatar URL and connected, show the actual avatar
  if (isConnected && avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt="Bot Avatar"
        className="w-9 h-9 rounded-full object-cover border-2"
        style={{ borderColor: colors.border }}
      />
    )
  }

  // Default avatar icons
  const Icon = platform === 'discord' ? Gamepad2 : Bot
  const DefaultIcon = platform === 'discord' ? Gamepad2 : MessageCircle

  return (
    <div
      className={`w-9 h-9 rounded-full flex items-center justify-center ${
        isConnected
          ? ''
          : 'bg-[var(--bg-card)] border border-[var(--border-color)]'
      }`}
      style={isConnected ? { background: `linear-gradient(to bottom right, ${colors.from}, ${colors.to})` } : {}}
    >
      {isConnected ? (
        <Icon className="w-5 h-5 text-white" />
      ) : (
        <DefaultIcon className="w-5 h-5 text-[var(--text-muted)]" />
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

export function Header({ title, subtitle, showTelegramStatus, showDiscordStatus }: HeaderProps): JSX.Element {
  const [telegramStatus, setTelegramStatus] = useState<BotStatus | null>(null)
  const [discordStatus, setDiscordStatus] = useState<BotStatus | null>(null)
  const [connecting, setConnecting] = useState(false)
  const [showBoundUsers, setShowBoundUsers] = useState(false)
  const [llmStatus, setLLMStatus] = useState<LLMStatusInfo>({ status: 'idle' })

  // Current platform status
  const status = showTelegramStatus ? telegramStatus : showDiscordStatus ? discordStatus : null
  const platform = showTelegramStatus ? 'telegram' : showDiscordStatus ? 'discord' : null

  // Platform colors
  const platformColors = platform === 'discord'
    ? { from: '#5865F2', to: '#7289DA', shadow: '#5865F2' }
    : { from: '#7DCBF7', to: '#2596D1', shadow: '#2596D1' }

  // Subscribe to LLM status changes
  useEffect(() => {
    const unsubscribe = window.llm.onStatusChanged((newStatus: LLMStatusInfo) => {
      setLLMStatus(newStatus)
    })
    window.llm.getStatus().then(setLLMStatus)
    return () => unsubscribe()
  }, [])

  // Subscribe to Telegram status
  useEffect(() => {
    if (showTelegramStatus) {
      checkTelegramStatus()
      const unsubscribe = window.telegram.onStatusChanged((newStatus: BotStatus) => {
        setTelegramStatus(newStatus)
      })
      return () => unsubscribe()
    }
  }, [showTelegramStatus])

  // Subscribe to Discord status
  useEffect(() => {
    if (showDiscordStatus) {
      checkDiscordStatus()
      const unsubscribe = window.discord.onStatusChanged((newStatus: BotStatus) => {
        setDiscordStatus(newStatus)
      })
      return () => unsubscribe()
    }
  }, [showDiscordStatus])

  const checkTelegramStatus = async () => {
    try {
      const result = await window.telegram.getStatus()
      if (result.success && result.data) {
        setTelegramStatus(result.data)
      }
    } catch (error) {
      console.error('Failed to get Telegram status:', error)
    }
  }

  const checkDiscordStatus = async () => {
    try {
      const result = await window.discord.getStatus()
      if (result.success && result.data) {
        setDiscordStatus(result.data)
      }
    } catch (error) {
      console.error('Failed to get Discord status:', error)
    }
  }

  const handleConnect = async () => {
    setConnecting(true)
    try {
      if (showTelegramStatus) {
        const result = await window.telegram.connect()
        if (!result.success) {
          setTelegramStatus({ platform: 'telegram', isConnected: false, error: result.error })
          toast.error(result.error || 'Failed to connect Telegram bot')
        } else {
          toast.success('Telegram bot connected successfully')
        }
        await checkTelegramStatus()
      } else if (showDiscordStatus) {
        const result = await window.discord.connect()
        if (!result.success) {
          setDiscordStatus({ platform: 'discord', isConnected: false, error: result.error })
          toast.error(result.error || 'Failed to connect Discord bot')
        } else {
          toast.success('Discord bot connected successfully')
        }
        await checkDiscordStatus()
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Connection failed'
      toast.error(errorMessage)
    }
    setConnecting(false)
  }

  const handleDisconnect = async () => {
    try {
      if (showTelegramStatus) {
        await window.telegram.disconnect()
        toast.info('Telegram bot disconnected')
        await checkTelegramStatus()
      } else if (showDiscordStatus) {
        await window.discord.disconnect()
        toast.info('Discord bot disconnected')
        await checkDiscordStatus()
      }
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
  const showStatus = showTelegramStatus || showDiscordStatus

  // Get display info based on connection status
  const displayName = showStatus
    ? isConnected
      ? status?.botName || status?.username || 'Bot'
      : platform === 'discord' ? 'Discord' : 'Telegram'
    : title
  const displaySubtitle = showStatus
    ? isConnected
      ? `@${status?.username}`
      : 'AI Assistant'
    : subtitle
  const avatarUrl = status?.avatarUrl

  return (
    <header className="h-14 flex items-center justify-between px-5 bg-[var(--glass-bg)] backdrop-blur-xl border-b border-[var(--glass-border)]">
      {/* Title with Avatar */}
      <div className="flex items-center gap-3">
        {/* Avatar */}
        {showStatus && platform && (
          <BotAvatar isConnected={!!isConnected} avatarUrl={avatarUrl} platform={platform} />
        )}

        {/* Title and Subtitle */}
        <div className="flex items-center gap-2">
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-[15px] font-semibold text-[var(--text-primary)] leading-tight">
                {displayName}
              </h1>
              {/* Connection status dot */}
              {showStatus && (
                <Circle
                  className={`w-2 h-2 ${isConnected ? 'fill-emerald-500 text-emerald-500' : 'fill-[var(--text-muted)] text-[var(--text-muted)]'}`}
                />
              )}
            </div>
            {displaySubtitle && (
              <p className="text-[11px] text-[var(--text-muted)] leading-tight">{displaySubtitle}</p>
            )}
          </div>

          {/* Bound Users Button */}
          {showStatus && (
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
        {showStatus && (
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
                  : ''
              } disabled:opacity-50 disabled:cursor-not-allowed`}
              style={!isConnected ? {
                background: `linear-gradient(to right, ${platformColors.from}, ${platformColors.to})`,
                color: 'white',
                boxShadow: `0 10px 15px -3px ${platformColors.shadow}40`
              } : {}}
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

      {/* Bound Users Modal - Telegram */}
      {showTelegramStatus && (
        <BoundUsersModal isOpen={showBoundUsers} onClose={() => setShowBoundUsers(false)} />
      )}

      {/* Bound Users Modal - Discord */}
      {showDiscordStatus && (
        <DiscordBoundUsersModal isOpen={showBoundUsers} onClose={() => setShowBoundUsers(false)} />
      )}
    </header>
  )
}
