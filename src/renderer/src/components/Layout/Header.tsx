import { useState, useEffect } from 'react'
import { Power, Loader2, Circle, Users, ExternalLink } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from '../Toast'
import { BoundUsersModal, LLMStatusIndicator } from '../Shared'
import { TelegramIcon, DiscordIcon, SlackIcon, FeishuIcon } from '../Icons/AppIcons'

interface HeaderProps {
  title: string
  subtitle?: string
  showTelegramStatus?: boolean
  showDiscordStatus?: boolean
  showSlackStatus?: boolean
  showFeishuStatus?: boolean
  onShowActivity?: () => void
}

type Platform = 'telegram' | 'discord' | 'slack' | 'feishu'

// Platform tutorial links
const platformTutorialLinks: Partial<Record<Platform, string>> = {
  telegram: 'https://memu.bot/tutorial/telegram',
  discord: 'https://memu.bot/tutorial/discord',
  feishu: 'https://memu.bot/tutorial/feishu'
}

// Bot avatar component - supports Telegram, Discord, and Slack themes
function BotAvatar({
  isConnected,
  avatarUrl,
  platform
}: {
  isConnected: boolean
  avatarUrl?: string
  platform: Platform
}): JSX.Element {
  const colorMap = {
    telegram: { from: '#7DCBF7', to: '#2596D1', border: '#7DCBF7' },
    discord: { from: '#5865F2', to: '#7289DA', border: '#5865F2' },
    slack: { from: '#4A154B', to: '#611F69', border: '#4A154B' },
    feishu: { from: '#3370FF', to: '#5B8FF9', border: '#3370FF' }
  }
  const colors = colorMap[platform]

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

  // Platform icon component
  const iconMap = {
    telegram: TelegramIcon,
    discord: DiscordIcon,
    slack: SlackIcon,
    feishu: FeishuIcon
  }
  const PlatformIcon = iconMap[platform]

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
        <PlatformIcon className="w-5 h-5 text-white" />
      ) : (
        <PlatformIcon className="w-5 h-5 text-[var(--text-muted)]" />
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

export function Header({ title, subtitle, showTelegramStatus, showDiscordStatus, showSlackStatus, showFeishuStatus, onShowActivity }: HeaderProps): JSX.Element {
  const { t } = useTranslation()
  const [telegramStatus, setTelegramStatus] = useState<BotStatus | null>(null)
  const [discordStatus, setDiscordStatus] = useState<BotStatus | null>(null)
  const [slackStatus, setSlackStatus] = useState<BotStatus | null>(null)
  const [feishuStatus, setFeishuStatus] = useState<BotStatus | null>(null)
  const [connecting, setConnecting] = useState(false)
  const [showBoundUsers, setShowBoundUsers] = useState(false)

  // Determine current platform
  const platform: Platform | null = showTelegramStatus
    ? 'telegram'
    : showDiscordStatus
    ? 'discord'
    : showSlackStatus
    ? 'slack'
    : showFeishuStatus
    ? 'feishu'
    : null

  // Current platform status
  const status = showTelegramStatus
    ? telegramStatus
    : showDiscordStatus
    ? discordStatus
    : showSlackStatus
    ? slackStatus
    : showFeishuStatus
    ? feishuStatus
    : null

  // Platform colors
  const platformColorMap = {
    telegram: { from: '#7DCBF7', to: '#2596D1', shadow: '#2596D1' },
    discord: { from: '#5865F2', to: '#7289DA', shadow: '#5865F2' },
    slack: { from: '#4A154B', to: '#611F69', shadow: '#4A154B' },
    feishu: { from: '#3370FF', to: '#5B8FF9', shadow: '#3370FF' }
  }
  const platformColors = platform ? platformColorMap[platform] : platformColorMap.telegram

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

  // Subscribe to Slack status
  useEffect(() => {
    if (showSlackStatus) {
      checkSlackStatus()
      const unsubscribe = window.slack.onStatusChanged((newStatus: BotStatus) => {
        setSlackStatus(newStatus)
      })
      return () => unsubscribe()
    }
  }, [showSlackStatus])

  // Subscribe to Feishu status
  useEffect(() => {
    if (showFeishuStatus) {
      checkFeishuStatus()
      const unsubscribe = window.feishu.onStatusChanged((newStatus: BotStatus) => {
        setFeishuStatus(newStatus)
      })
      return () => unsubscribe()
    }
  }, [showFeishuStatus])

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

  const checkSlackStatus = async () => {
    try {
      const result = await window.slack.getStatus()
      if (result.success && result.data) {
        setSlackStatus(result.data)
      }
    } catch (error) {
      console.error('Failed to get Slack status:', error)
    }
  }

  const checkFeishuStatus = async () => {
    try {
      const result = await window.feishu.getStatus()
      if (result.success && result.data) {
        setFeishuStatus(result.data)
      }
    } catch (error) {
      console.error('Failed to get Feishu status:', error)
    }
  }

  const handleConnect = async () => {
    setConnecting(true)
    try {
      if (showTelegramStatus) {
        const result = await window.telegram.connect()
        if (!result.success) {
          setTelegramStatus({ platform: 'telegram', isConnected: false, error: result.error })
          toast.error(result.error || t('errors.connectionFailed'))
        } else {
          toast.success(`Telegram ${t('common.connected').toLowerCase()}`)
        }
        await checkTelegramStatus()
      } else if (showDiscordStatus) {
        const result = await window.discord.connect()
        if (!result.success) {
          setDiscordStatus({ platform: 'discord', isConnected: false, error: result.error })
          toast.error(result.error || t('errors.connectionFailed'))
        } else {
          toast.success(`Discord ${t('common.connected').toLowerCase()}`)
        }
        await checkDiscordStatus()
      } else if (showSlackStatus) {
        const result = await window.slack.connect()
        if (!result.success) {
          setSlackStatus({ platform: 'slack', isConnected: false, error: result.error })
          toast.error(result.error || t('errors.connectionFailed'))
        } else {
          toast.success(`Slack ${t('common.connected').toLowerCase()}`)
        }
        await checkSlackStatus()
      } else if (showFeishuStatus) {
        const result = await window.feishu.connect()
        if (!result.success) {
          setFeishuStatus({ platform: 'feishu', isConnected: false, error: result.error })
          toast.error(result.error || t('errors.connectionFailed'))
        } else {
          toast.success(`Feishu ${t('common.connected').toLowerCase()}`)
        }
        await checkFeishuStatus()
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : t('errors.connectionFailed')
      toast.error(errorMessage)
    }
    setConnecting(false)
  }

  const handleDisconnect = async () => {
    try {
      if (showTelegramStatus) {
        await window.telegram.disconnect()
        toast.info(`Telegram ${t('common.disconnected').toLowerCase()}`)
        await checkTelegramStatus()
      } else if (showDiscordStatus) {
        await window.discord.disconnect()
        toast.info(`Discord ${t('common.disconnected').toLowerCase()}`)
        await checkDiscordStatus()
      } else if (showSlackStatus) {
        await window.slack.disconnect()
        toast.info(`Slack ${t('common.disconnected').toLowerCase()}`)
        await checkSlackStatus()
      } else if (showFeishuStatus) {
        await window.feishu.disconnect()
        toast.info(`Feishu ${t('common.disconnected').toLowerCase()}`)
        await checkFeishuStatus()
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : t('errors.connectionFailed')
      toast.error(errorMessage)
      console.error('Disconnect failed:', error)
    }
  }

  const isConnected = status?.isConnected
  const showStatus = showTelegramStatus || showDiscordStatus || showSlackStatus || showFeishuStatus

  // Get display info based on connection status
  const platformName = platform ? t(`nav.${platform}`) : ''
  const displayName = showStatus
    ? isConnected
      ? status?.botName || status?.username || t('messages.bot')
      : platformName
    : title
  const displaySubtitle = showStatus
    ? isConnected
      ? status?.username ? `@${status.username}` : ''
      : t('header.aiAssistant')
    : subtitle
  const avatarUrl = status?.avatarUrl
  const tutorialLink = platform ? platformTutorialLinks[platform] : undefined

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
              showStatus && !isConnected && tutorialLink ? (
                <a
                  href={tutorialLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[11px] leading-tight transition-colors hover:opacity-80"
                  style={{ color: platformColors.from }}
                >
                  <span>{t('header.viewTutorial')}</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              ) : (
                <p className="text-[11px] text-[var(--text-muted)] leading-tight">{displaySubtitle}</p>
              )
            )}
          </div>

          {/* Bound Users Button */}
          {showStatus && (
            <button
              onClick={() => setShowBoundUsers(true)}
              className="p-1.5 rounded-lg hover:bg-[var(--bg-card)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all"
              title={t('settings.security.boundUsers')}
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
            <LLMStatusIndicator onShowActivity={onShowActivity} />

            {/* Connect/Disconnect Button */}
            <button
              onClick={isConnected ? handleDisconnect : handleConnect}
              disabled={connecting}
              title={connecting ? t('common.connecting') : isConnected ? t('common.disconnect') : t('common.connect')}
              className={`w-9 h-9 flex items-center justify-center rounded-lg transition-all duration-200 border ${
                isConnected
                  ? 'bg-red-500/10 dark:bg-red-500/20 backdrop-blur-sm border-red-500/20 text-red-600 dark:text-red-400 hover:bg-red-500/20 hover:shadow-md'
                  : 'border-transparent'
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
        <BoundUsersModal isOpen={showBoundUsers} onClose={() => setShowBoundUsers(false)} platform="telegram" />
      )}

      {/* Bound Users Modal - Discord */}
      {showDiscordStatus && (
        <BoundUsersModal isOpen={showBoundUsers} onClose={() => setShowBoundUsers(false)} platform="discord" />
      )}

      {/* Bound Users Modal - Slack */}
      {showSlackStatus && (
        <BoundUsersModal isOpen={showBoundUsers} onClose={() => setShowBoundUsers(false)} platform="slack" />
      )}

      {/* Bound Users Modal - Feishu */}
      {showFeishuStatus && (
        <BoundUsersModal isOpen={showBoundUsers} onClose={() => setShowBoundUsers(false)} platform="feishu" />
      )}
    </header>
  )
}
