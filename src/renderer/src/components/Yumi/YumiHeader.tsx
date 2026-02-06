import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { RefreshCw } from 'lucide-react'
import { useEasemobStore } from '../../stores/easemobStore'
import { reconnectEasemob } from '../../services/easemob/autoConnect'
import { LLMStatusIndicator } from '../Shared'

interface YumiHeaderProps {
  onShowActivity?: () => void
}

export function YumiHeader({ onShowActivity }: YumiHeaderProps): JSX.Element {
  const { t } = useTranslation()
  const { connected, connecting, error } = useEasemobStore()
  const [reconnecting, setReconnecting] = useState(false)

  const statusText = connecting
    ? t('common.connecting')
    : connected
      ? t('common.connected')
      : t('common.disconnected')
  const statusColor = connecting
    ? 'bg-amber-400'
    : connected
      ? 'bg-emerald-400'
      : 'bg-gray-400'

  const handleReconnect = async (): Promise<void> => {
    setReconnecting(true)
    try {
      await reconnectEasemob()
    } finally {
      setReconnecting(false)
    }
  }

  return (
    <header className="h-14 flex items-center justify-between px-5 bg-[var(--glass-bg)] backdrop-blur-xl border-b border-[var(--glass-border)]">
      {/* Title + Agent Status */}
      <div className="flex items-center gap-3">
        <h1 className="text-[15px] font-semibold text-[var(--text-primary)] leading-tight">
          Yumi
        </h1>

        <LLMStatusIndicator onShowActivity={onShowActivity} />
      </div>

      {/* IM Status */}
      <div className="flex items-center gap-2 text-[12px] text-[var(--text-muted)]">
        <span className={`w-2 h-2 rounded-full ${statusColor}`} />
        <span className="text-[var(--text-secondary)]">{statusText}</span>
        {error && (
          <span className="text-[11px] text-rose-500 truncate max-w-[140px]">
            {error}
          </span>
        )}
        {/* Reconnect button */}
        {!connecting && (
          <button
            onClick={handleReconnect}
            disabled={reconnecting}
            className="ml-1 p-1 rounded-md hover:bg-[var(--bg-input)] transition-colors text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
            title={t('common.reconnect', 'Reconnect')}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${reconnecting ? 'animate-spin' : ''}`} />
          </button>
        )}
      </div>
    </header>
  )
}
